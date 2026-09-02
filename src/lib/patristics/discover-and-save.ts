import { prisma } from "@/lib/prisma";

import {
  discoverPatristicSources,
  type PatristicDiscoveryCandidate,
} from "./web-discovery";

import {
  fetchSourceText,
} from "./fetch-source";

import {
  extractRelevantPatristicQuotes,
} from "./extract-quotes";

import {
  exactQuoteExists,
} from "./verify";

import {
  findTrustedPatristicSource,
} from "./trusted-sources";

import {
  verifyDiscoveryCandidates,
} from "./verify-discovery";

import {
  verifyCandidateAttribution,
} from "./verify-attribution";

import {
  saveVerifiedDiscoveryCandidate,
} from "./save-quotes";

import {
  translateQuote,
} from "./backfill-translations";


export async function discoverAndSavePatristicQuotes(
  query: string,
  language: "sr" | "en",
) {
  /*
   * STEP 1
   *
   * Web discovery is used only to discover potentially
   * relevant source URLs.
   *
   * We no longer trust originalText returned by web
   * discovery as the quotation that will be saved.
   */
  const discovered =
    await discoverPatristicSources({
      query,
      language,
    });


  /*
   * Remove duplicate URLs.
   *
   * Several web-search candidates can point to the
   * same document.
   */
  const sourceUrls = [
    ...new Set(
      discovered.map(
        (candidate) =>
          candidate.sourceUrl,
      ),
    ),
  ];


  /*
   * STEP 2
   *
   * Fetch trusted sources ourselves and extract
   * quotations directly from the fetched text.
   *
   * These are the candidates which may eventually
   * enter the database.
   */
  const extractedFromFetchedSources:
    PatristicDiscoveryCandidate[] = [];


  for (const sourceUrl of sourceUrls) {
    try {
      /*
       * Do not spend extraction resources on sources
       * that are not currently accepted as trusted
       * textual witnesses.
       */
      const trustedSource =
        findTrustedPatristicSource(
          sourceUrl,
        );

      if (!trustedSource) {
        continue;
      }


      /*
       * Fetch the actual HTML/PDF text with our own
       * server-side fetcher.
       */
      const source =
        await fetchSourceText(
          sourceUrl,
        );


      /*
       * Ask the extraction model to copy only passages
       * relevant to the user's question from the text
       * we actually fetched.
       */
      const extracted =
        await extractRelevantPatristicQuotes(
          source.text,
          sourceUrl,
          query,
        );


      /*
       * Programmatic verification remains mandatory.
       *
       * Even though the extraction model was instructed
       * to copy text character-for-character, we still
       * independently check that the quotation actually
       * occurs in the fetched source.
       */
      for (const candidate of extracted) {
        const exactMatch =
          exactQuoteExists(
            candidate.originalText,
            source.text,
          );

        if (!exactMatch) {
          console.warn(
            "PATRISTIC_LOCAL_EXTRACTION_REJECTED:",
            JSON.stringify({
              sourceUrl,
              originalText:
                candidate.originalText,
            }),
          );

          continue;
        }


        extractedFromFetchedSources.push({
          ...candidate,

          sourceUrl,

          sourceName:
            trustedSource.name,
        });
      }
    } catch (error) {
      console.error(
        "PATRISTIC_FETCHED_SOURCE_EXTRACTION_ERROR:",
        sourceUrl,
        error,
      );
    }
  }


  /*
   * STEP 3
   *
   * Run the normal discovery verifier over the
   * quotations extracted from fetched source text.
   *
   * This deliberately does NOT verify the quotations
   * originally proposed by web search.
   */
  const verified =
    await verifyDiscoveryCandidates(
      extractedFromFetchedSources,
    );


  /*
   * Temporary diagnostics.
   *
   * Keep this while we are testing the new pipeline.
   */
  console.log(
    "PATRISTIC_DISCOVERY_CANDIDATES_JSON:",
    JSON.stringify(
      verified.map(
        (candidate) => ({
          authorName:
            candidate.authorName,

          workTitle:
            candidate.workTitle,

          originalLanguage:
            candidate.originalLanguage,

          originalText:
            candidate.originalText,

          sourceUrl:
            candidate.sourceUrl,

          exactMatch:
            candidate.exactMatch,

          trustedSource:
            candidate.trustedSource,

          verificationError:
            candidate.verificationError,
        }),
      ),
      null,
      2,
    ),
  );


  const exactMatches =
    verified.filter(
      (candidate) =>
        candidate.exactMatch,
    );


  const trustedExactMatches =
    exactMatches.filter(
      (candidate) =>
        candidate.trustedSource,
    );


  /*
   * STEP 4
   *
   * Verify that the fetched quotation is really
   * attributable to the claimed author/work.
   */
  const attributionResults =
    await Promise.all(
      trustedExactMatches.map(
        async (candidate) => {
          const attribution =
            await verifyCandidateAttribution(
              candidate,
            );

          return {
            ...candidate,
            attribution,
          };
        },
      ),
    );


  const attributionVerified =
    attributionResults.filter(
      (candidate) => {
        if (
          !candidate.attribution
            .matchesClaimedAuthor
        ) {
          return false;
        }

        if (!candidate.authorName) {
          console.warn(
            "PATRISTIC_INCOMPLETE_CANDIDATE_SKIPPED:",
            JSON.stringify({
              reason:
                "missing authorName",

              sourceUrl:
                candidate.sourceUrl,

              originalText:
                candidate.originalText,
            }),
          );

          return false;
        }

        if (!candidate.workTitle) {
          console.warn(
            "PATRISTIC_INCOMPLETE_CANDIDATE_SKIPPED:",
            JSON.stringify({
              reason:
                "missing workTitle",

              authorName:
                candidate.authorName,

              sourceUrl:
                candidate.sourceUrl,

              originalText:
                candidate.originalText,
            }),
          );

          return false;
        }

        return true;
      },
    );


  /*
   * STEP 5
   *
   * Save the verified original text.
   *
   * Only after the original quotation has survived
   * exact-text and attribution checks do we generate
   * translations.
   */
  const savedResults =
    await Promise.all(
      attributionVerified.map(
        async (candidate) => {
          const saved =
            await saveVerifiedDiscoveryCandidate(
              candidate,
              candidate.attribution,
            );


          /*
           * Translation is generated from the exact
           * verified originalText, never from remembered
           * or web-search text.
           */
          const translation =
            await translateQuote(
              candidate.originalText,
              candidate.originalLanguage ??
                "Unknown",
            );


          const translatedQuote =
            await prisma
              .patristicQuote
              .update({
                where: {
                  id: saved.id,
                },

                data: {
                  translationSr:
                    saved.translationSr ??
                    translation.translationSr,

                  translationEn:
                    saved.translationEn ??
                    translation.translationEn,
                },
              });


          return {
            candidate,

            saved: {
              id:
                translatedQuote.id,

              verification:
                translatedQuote
                  .verification,

              confidence:
                translatedQuote
                  .confidence,
            },
          };
        },
      ),
    );


  return {
    query,

    /*
     * Number originally discovered on the web.
     */
    discovered:
      discovered.length,

    /*
     * Useful diagnostic: how many quotations were
     * actually extracted from content fetched by
     * our server.
     */
    extractedFromFetchedSources:
      extractedFromFetchedSources.length,

    exactMatches:
      exactMatches.length,

    trustedExactMatches:
      trustedExactMatches.length,

    attributionVerified:
      attributionVerified.length,

    saved:
      savedResults.length,

    result:
      savedResults,
  };
}
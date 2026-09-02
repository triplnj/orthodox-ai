import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { prisma } from "@/lib/prisma";

import {
  discoverPatristicSources,
} from "./web-discovery";

import {
  fetchSourceText,
} from "./fetch-source";

import {
  exactQuoteExists,
} from "./verify";

import {
  findTrustedPatristicSource,
} from "./trusted-sources";

import {
  verifyCandidateAttribution,
} from "./verify-attribution";

import {
  extractRelevantPatristicQuotes,
} from "./extract-quotes";

import type {
  VerifiedDiscoveryCandidate,
} from "./verify-discovery";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const ParallelWitnessSchema = z.object({
  samePassage: z.boolean(),

  confidence: z.number()
    .min(0)
    .max(100),

  reason: z.string(),
});


function getHostname(
  url: string,
) {
  try {
    return new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}


function getSourceIdentity(
  url: string,
) {
  const trusted =
    findTrustedPatristicSource(url);

  if (trusted) {
    return trusted.domain;
  }

  return getHostname(url);
}


/*
 * This check does NOT verify that either quotation
 * exists in its source.
 *
 * Exact source verification is performed separately
 * with exactQuoteExists().
 *
 * This function answers only:
 *
 * Are quotation A and quotation B witnesses to the
 * same patristic passage?
 */
async function verifyParallelWitness(
  firstQuote: {
    authorName: string;
    workTitle: string;
    originalLanguage: string;
    originalText: string;
    section: string | null;
    chapter: string | null;
    paragraph: string | null;
    pgReference: string | null;
    scReference: string | null;
    cpgReference: string | null;
  },

  secondQuote: {
    authorName: string | null;
    workTitle: string | null;
    originalLanguage: string | null;
    originalText: string;
    section: string | null;
    chapter: string | null;
    paragraph: string | null;
    pgReference: string | null;
    scReference: string | null;
    cpgReference: string | null;
  },
) {
  const model =
    process.env.PATRISTICS_MODEL;

  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }


  const response =
    await openai.responses.parse({
      model,

      input: [
        {
          role: "system",
          content: `
You verify whether two independently
source-verified patristic quotations are witnesses
to the SAME passage.

CRITICAL RULES:

1. Do not use memory.

2. Do not decide merely because both quotations
discuss the same theological subject.

3. samePassage may be true when the second text is:
   - the same original-language passage with minor
     editorial differences;
   - the same passage with different punctuation,
     accentuation or orthography;
   - a faithful translation of the same passage;
   - a parallel edition of the same textual passage.

4. samePassage MUST be false if the texts are merely:
   - similar in doctrine;
   - from the same author;
   - from the same work but a different passage;
   - paraphrases without sufficient evidence that
     they represent the same textual passage.

5. Bibliographic evidence such as work title,
chapter, section, PG, SC or CPG reference may be
used when supplied.

6. If there is meaningful doubt, return
samePassage false.

7. confidence must describe confidence that these
are witnesses to the same textual passage.

8. Do not invent missing references.
          `,
        },

        {
          role: "user",
          content: `
FIRST VERIFIED QUOTATION

AUTHOR:
${firstQuote.authorName}

WORK:
${firstQuote.workTitle}

LANGUAGE:
${firstQuote.originalLanguage}

SECTION:
${firstQuote.section ?? "unknown"}

CHAPTER:
${firstQuote.chapter ?? "unknown"}

PARAGRAPH:
${firstQuote.paragraph ?? "unknown"}

PG:
${firstQuote.pgReference ?? "unknown"}

SC:
${firstQuote.scReference ?? "unknown"}

CPG:
${firstQuote.cpgReference ?? "unknown"}

TEXT:
${firstQuote.originalText}


SECOND VERIFIED QUOTATION

AUTHOR:
${secondQuote.authorName ?? "unknown"}

WORK:
${secondQuote.workTitle ?? "unknown"}

LANGUAGE:
${secondQuote.originalLanguage ?? "unknown"}

SECTION:
${secondQuote.section ?? "unknown"}

CHAPTER:
${secondQuote.chapter ?? "unknown"}

PARAGRAPH:
${secondQuote.paragraph ?? "unknown"}

PG:
${secondQuote.pgReference ?? "unknown"}

SC:
${secondQuote.scReference ?? "unknown"}

CPG:
${secondQuote.cpgReference ?? "unknown"}

TEXT:
${secondQuote.originalText}
          `.trim(),
        },
      ],

      text: {
        format: zodTextFormat(
          ParallelWitnessSchema,
          "parallel_patristic_witness",
        ),
      },
    });


  return (
    response.output_parsed ?? {
      samePassage: false,
      confidence: 0,
      reason:
        "No parsed verification result.",
    }
  );
}


export async function verifyQuotesAgainstPg(
  quoteIds?: string[],
) {

  const quotes =
    await prisma.patristicQuote.findMany({
      where: {
        verification:
          "TEXT_VERIFIED",

        ...(quoteIds &&
        quoteIds.length > 0
          ? {
              id: {
                in: quoteIds,
              },
            }
          : {}),
      },

      include: {
        sources: true,
      },
    });


  let checked = 0;
  let matched = 0;
  let notMatched = 0;
  let discoveryErrors = 0;
  let candidatesDiscovered = 0;
  let candidateSourcesChecked = 0;


  for (const quote of quotes) {

    checked++;


    const existingSourceIdentities =
      new Set(
        quote.sources
          .map((source) =>
            getSourceIdentity(
              source.url,
            ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      );


    const existingUrls =
      new Set(
        quote.sources.map(
          (source) =>
            source.url,
        ),
      );


    let discovered;

    try {

      /*
       * IMPORTANT:
       *
       * We are no longer asking web search for the
       * exact Unicode string.
       *
       * We are asking it to locate an independent
       * textual witness to the same passage.
       */
      discovered =
        await discoverPatristicSources({
          language: "en",

          query: `
Find an independent textual witness for the SAME
patristic passage.

AUTHOR:
${quote.authorName}

WORK:
${quote.workTitle}

ORIGINAL VERIFIED PASSAGE:
${quote.originalText}

KNOWN REFERENCES:

SECTION:
${quote.section ?? "unknown"}

CHAPTER:
${quote.chapter ?? "unknown"}

PARAGRAPH:
${quote.paragraph ?? "unknown"}

PG:
${quote.pgReference ?? "unknown"}

SC:
${quote.scReference ?? "unknown"}

CPG:
${quote.cpgReference ?? "unknown"}

The second source does NOT need to reproduce the
same Unicode string.

It may be:

- another edition of the original text;
- the same passage with different punctuation,
  accents or orthography;
- a translation of the same passage.

It must represent the SAME textual passage, not
merely a similar theological statement.

Prefer a different independent repository,
publisher or textual edition.

Already used source URLs:

${quote.sources
  .map((source) => source.url)
  .join("\n")}
          `.trim(),
        });

    } catch (error) {

      console.error(
        "SECOND_SOURCE_DISCOVERY_ERROR",
        quote.id,
        error,
      );

      discoveryErrors++;

      continue;
    }


    candidatesDiscovered +=
      discovered.length;


    let matchedCandidate:
      VerifiedDiscoveryCandidate | null =
        null;


    for (const candidate of discovered) {

      if (!candidate.sourceUrl) {
        continue;
      }


      if (
        existingUrls.has(
          candidate.sourceUrl,
        )
      ) {
        continue;
      }


      const sourceIdentity =
        getSourceIdentity(
          candidate.sourceUrl,
        );


      if (!sourceIdentity) {
        continue;
      }


      /*
       * A second page on the same repository is not
       * considered an independent second source.
       */
      if (
        existingSourceIdentities.has(
          sourceIdentity,
        )
      ) {
        continue;
      }


      const trustedSource =
        findTrustedPatristicSource(
          candidate.sourceUrl,
        );


      if (!trustedSource) {
        continue;
      }


      candidateSourcesChecked++;


      let sourceText: string;

      try {

        const fetched =
          await fetchSourceText(
            candidate.sourceUrl,
          );

        sourceText =
          fetched.text;

      } catch (error) {

        console.warn(
          "SECOND_SOURCE_FETCH_SKIPPED",
          candidate.sourceUrl,
          error instanceof Error
            ? error.message
            : "Unknown fetch error",
        );

        continue;
      }


      /*
       * CRITICAL CHANGE:
       *
       * Extract the actual relevant passage from the
       * text WE fetched from the second source.
       *
       * We do not trust candidate.originalText supplied
       * by web discovery.
       */
      let extractedQuotes;

      try {

        extractedQuotes =
          await extractRelevantPatristicQuotes(
            sourceText,
            candidate.sourceUrl,
            `
Find the passage corresponding to this verified
quotation from ${quote.authorName},
${quote.workTitle}:

${quote.originalText}

The relevant text may be the same original passage,
a differently edited version of it, or a faithful
translation of the same passage.

Do not return merely a thematically similar passage.
            `.trim(),
          );

      } catch (error) {

        console.warn(
          "SECOND_SOURCE_EXTRACTION_SKIPPED",
          candidate.sourceUrl,
          error instanceof Error
            ? error.message
            : "Unknown extraction error",
        );

        continue;
      }


      for (
        const extractedQuote
        of extractedQuotes
      ) {

        /*
         * The second quotation itself must occur
         * exactly in the second source.
         */
        const exactMatch =
          exactQuoteExists(
            extractedQuote.originalText,
            sourceText,
          );


        if (!exactMatch) {
          continue;
        }


        const verifiedCandidate:
          VerifiedDiscoveryCandidate = {
            ...candidate,

            authorName:
              extractedQuote.authorName ??
              quote.authorName,

            workTitle:
              extractedQuote.workTitle ??
              quote.workTitle,

            originalLanguage:
              extractedQuote.originalLanguage ??
              candidate.originalLanguage,

            originalText:
              extractedQuote.originalText,

            translationSr:
              extractedQuote.translationSr,

            translationEn:
              extractedQuote.translationEn,

            exactMatch:
              true,

            trustedSource:
              true,

            trustLevel:
              trustedSource.trustLevel,

            trustedSourceType:
              trustedSource.sourceType,

            verificationError:
              null,
          };


        /*
         * Verify that the second source really
         * attributes this passage to the claimed
         * patristic author/work.
         */
        const attribution =
          await verifyCandidateAttribution(
            verifiedCandidate,
          );


        if (
          !attribution
            .matchesClaimedAuthor
        ) {
          continue;
        }


        /*
         * Finally determine whether the independently
         * exact-verified second passage is actually a
         * witness to the SAME passage.
         */
        const parallel =
          await verifyParallelWitness(
            {
              authorName:
                quote.authorName,

              workTitle:
                quote.workTitle,

              originalLanguage:
                quote.originalLanguage,

              originalText:
                quote.originalText,

              section:
                quote.section,

              chapter:
                quote.chapter,

              paragraph:
                quote.paragraph,

              pgReference:
                quote.pgReference,

              scReference:
                quote.scReference,

              cpgReference:
                quote.cpgReference,
            },

            {
              authorName:
                extractedQuote.authorName,

              workTitle:
                extractedQuote.workTitle,

              originalLanguage:
                extractedQuote.originalLanguage,

              originalText:
                extractedQuote.originalText,

              section:
                extractedQuote.section,

              chapter:
                extractedQuote.chapter,

              paragraph:
                extractedQuote.paragraph,

              pgReference:
                extractedQuote.pgReference,

              scReference:
                extractedQuote.scReference,

              cpgReference:
                extractedQuote.cpgReference,
            },
          );


        console.log(
          "SECOND_SOURCE_PARALLEL_CHECK:",
          {
            quoteId:
              quote.id,

            sourceUrl:
              candidate.sourceUrl,

            samePassage:
              parallel.samePassage,
confidence:
  parallel.confidence,

normalizedConfidence:
  parallel.confidence <= 1
    ? parallel.confidence * 100
    : parallel.confidence,

            reason:
              parallel.reason,
          },
        );


        /*
         * Require a high-confidence same-passage
         * decision.
         */
       const normalizedConfidence =
  parallel.confidence <= 1
    ? parallel.confidence * 100
    : parallel.confidence;


if (
  !parallel.samePassage ||
  normalizedConfidence < 90
) {
  continue;
}


        matchedCandidate =
          verifiedCandidate;

        break;
      }


      if (matchedCandidate) {
        break;
      }
    }


    if (!matchedCandidate) {

      notMatched++;

      continue;
    }


    await prisma.$transaction([

      prisma.patristicQuote.update({
        where: {
          id:
            quote.id,
        },

        data: {
          verification:
            "MULTI_SOURCE_VERIFIED",

          confidence:
            90,
        },
      }),


      prisma.patristicQuoteSource.upsert({
        where: {
          quoteId_url: {
            quoteId:
              quote.id,

            url:
              matchedCandidate
                .sourceUrl,
          },
        },

        update: {
          sourceName:
            matchedCandidate
              .sourceName,

          sourceType:
            matchedCandidate
              .trustedSourceType,

          exactMatch:
            true,

          retrievedAt:
            new Date(),
        },

        create: {
          quoteId:
            quote.id,

          url:
            matchedCandidate
              .sourceUrl,

          sourceName:
            matchedCandidate
              .sourceName,

          sourceType:
            matchedCandidate
              .trustedSourceType,

          exactMatch:
            true,
        },
      }),

    ]);


    matched++;
  }


  return {
    totalQuotes:
      quotes.length,

    checked,

    matched,

    notMatched,

    discoveryErrors,

    candidatesDiscovered,

    candidateSourcesChecked,
  };
}
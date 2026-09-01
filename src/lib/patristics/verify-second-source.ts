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

import type {
  VerifiedDiscoveryCandidate,
} from "./verify-discovery";


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

      discovered =
        await discoverPatristicSources({
          language: "en",

          query: `
Find an independent second textual source
for this exact patristic quotation.

AUTHOR:
${quote.authorName}

WORK:
${quote.workTitle}

EXACT QUOTATION:
${quote.originalText}

The second source must contain the exact
quotation text above.

Do not merely return a similar quotation,
translation, paraphrase, commentary,
or quotation from memory.

Prefer a different independent repository
or publisher from the source already used.

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


      const exactMatch =
        exactQuoteExists(
          quote.originalText,
          sourceText,
        );


      if (!exactMatch) {
        continue;
      }


      const verifiedCandidate:
        VerifiedDiscoveryCandidate = {
          ...candidate,

          authorName:
            quote.authorName,

          workTitle:
            quote.workTitle,

          originalLanguage:
            quote.originalLanguage,

          originalText:
            quote.originalText,

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


      matchedCandidate =
        verifiedCandidate;

      break;
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
import {
  discoverPatristicSources,
} from "./web-discovery";

import {
  verifyDiscoveryCandidates,
} from "./verify-discovery";

import {
  verifyCandidateAttribution,
} from "./verify-attribution";

import {
  saveVerifiedDiscoveryCandidate,
} from "./save-quotes";
import { translateQuote } from "./backfill-translations";
import { prisma } from "@/lib/prisma";

export async function discoverAndSavePatristicQuotes(
  query: string,
  language: "sr" | "en",
) {
  const discovered =
    await discoverPatristicSources({
      query,
      language,
    });

  const verified =
    await verifyDiscoveryCandidates(
      discovered,
    );
    console.log(
  "PATRISTIC_DISCOVERY_CANDIDATES_JSON:",
  JSON.stringify(
    verified.map((candidate) => ({
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
    })),
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
      (candidate) =>
        candidate.attribution
          .matchesClaimedAuthor,
    );

 const savedResults = await Promise.all(
  attributionVerified.map(async candidate => {
    const saved = await saveVerifiedDiscoveryCandidate(
      candidate,
      candidate.attribution,
    );

    const translation = await translateQuote(
      candidate.originalText,
      candidate.originalLanguage ?? "Unknown",
    );

    const translatedQuote =
      await prisma.patristicQuote.update({
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
        id: translatedQuote.id,
        verification:
          translatedQuote.verification,
        confidence:
          translatedQuote.confidence,
      },
    };
  }),
);

  return {
    query,
    discovered:
      discovered.length,

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
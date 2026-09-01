import { prisma } from "@/lib/prisma";

import type {
  ExtractedQuote,
} from "./types";

import type {
  VerifiedDiscoveryCandidate,
} from "./verify-discovery";

import type {
  AttributionResult,
} from "./verify-attribution";

import {
  quoteFingerprint,
} from "./fingerprint";

export async function saveVerifiedCandidate(
  quote: ExtractedQuote,
  sourceUrl: string,
) {
  const fingerprint =
    quoteFingerprint(
      quote.authorName,
      quote.workTitle,
      quote.originalText,
    );

  const saved =
    await prisma.patristicQuote.upsert({
      where: {
        fingerprint,
      },

      update: {
        ...(quote.translationSr
          ? {
              translationSr:
                quote.translationSr,
            }
          : {}),

        ...(quote.translationEn
          ? {
              translationEn:
                quote.translationEn,
            }
          : {}),

        ...(quote.pgReference
          ? {
              pgReference:
                quote.pgReference,
            }
          : {}),

        ...(quote.scReference
          ? {
              scReference:
                quote.scReference,
            }
          : {}),

        ...(quote.cpgReference
          ? {
              cpgReference:
                quote.cpgReference,
            }
          : {}),
      },

      create: {
        fingerprint,

        authorName:
          quote.authorName,

        authorNameOriginal:
          quote.authorNameOriginal,

        workTitle:
          quote.workTitle,

        workTitleOriginal:
          quote.workTitleOriginal,

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

        translationSr:
          quote.translationSr,

        translationEn:
          quote.translationEn,

        topics:
          quote.topics,

        verification:
          "TEXT_VERIFIED",

        confidence: 80,
      },
    });

  await prisma.patristicQuoteSource.upsert({
    where: {
      quoteId_url: {
        quoteId: saved.id,
        url: sourceUrl,
      },
    },

    update: {
      exactMatch: true,
      retrievedAt: new Date(),
    },

    create: {
      quoteId: saved.id,
      url: sourceUrl,
      exactMatch: true,
    },
  });

  return saved;
}

export async function saveVerifiedDiscoveryCandidate(
  candidate: VerifiedDiscoveryCandidate,
  attribution: AttributionResult,
) {
  if (!candidate.exactMatch) {
    throw new Error(
      "Discovery candidate is not exact-match verified.",
    );
  }

  if (!candidate.trustedSource) {
    throw new Error(
      "Discovery candidate source is not trusted.",
    );
  }

  if (!attribution.matchesClaimedAuthor) {
    throw new Error(
      "Discovery candidate attribution is not verified.",
    );
  }

  if (!candidate.authorName) {
    throw new Error(
      "Discovery candidate has no verified author.",
    );
  }

  if (!candidate.workTitle) {
    throw new Error(
      "Discovery candidate has no work title.",
    );
  }

  const fingerprint =
    quoteFingerprint(
      candidate.authorName,
      candidate.workTitle,
      candidate.originalText,
    );

  const saved =
    await prisma.patristicQuote.upsert({
      where: {
        fingerprint,
      },

      update: {
        ...(candidate.translationSr
          ? {
              translationSr:
                candidate.translationSr,
            }
          : {}),

        ...(candidate.translationEn
          ? {
              translationEn:
                candidate.translationEn,
            }
          : {}),
      },

      create: {
        fingerprint,

        authorName:
          candidate.authorName,

        authorNameOriginal:
          null,

        workTitle:
          candidate.workTitle,

        workTitleOriginal:
          null,

        originalLanguage:
          candidate.originalLanguage ??
          "unknown",

        originalText:
          candidate.originalText,

        section:
          null,

        chapter:
          null,

        paragraph:
          null,

        pgReference:
          null,

        scReference:
          null,

        cpgReference:
          null,

        translationSr:
          candidate.translationSr,

        translationEn:
          candidate.translationEn,

        topics: [],

        verification:
          "TEXT_VERIFIED",

        confidence: 85,
      },
    });

  await prisma.patristicQuoteSource.upsert({
    where: {
      quoteId_url: {
        quoteId: saved.id,
        url: candidate.sourceUrl,
      },
    },

    update: {
      ...(candidate.sourceName
        ? {
            sourceName:
              candidate.sourceName,
          }
        : {}),

      ...(candidate.trustedSourceType
        ? {
            sourceType:
              candidate.trustedSourceType,
          }
        : {}),

      exactMatch: true,

      retrievedAt:
        new Date(),
    },

    create: {
      quoteId:
        saved.id,

      url:
        candidate.sourceUrl,

      sourceName:
        candidate.sourceName,

      sourceType:
        candidate.trustedSourceType,

      exactMatch:
        true,
    },
  });

  return saved;
}
import {
  fetchSourceText,
} from "./fetch-source";

import {
  exactQuoteExists,
} from "./verify";

import {
  findTrustedPatristicSource,
} from "./trusted-sources";

import type {
  PatristicDiscoveryCandidate,
} from "./web-discovery";

export type VerifiedDiscoveryCandidate =
  PatristicDiscoveryCandidate & {
    exactMatch: boolean;

    trustedSource: boolean;
    trustLevel: number | null;
    trustedSourceType: string | null;

    verificationError: string | null;
  };

export async function verifyDiscoveryCandidates(
  candidates: PatristicDiscoveryCandidate[],
): Promise<VerifiedDiscoveryCandidate[]> {
  const results: VerifiedDiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const trustedSource =
      findTrustedPatristicSource(
        candidate.sourceUrl,
      );
      console.log(
  "PATRISTIC_TRUST_CHECK:",
  JSON.stringify({
    url: candidate.sourceUrl,
    hostname: (() => {
      try {
        return new URL(
          candidate.sourceUrl,
        )
          .hostname
          .toLowerCase()
          .replace(/^www\./, "");
      } catch {
        return null;
      }
    })(),
    trustedSource,
  }),
);

    try {
      const source =
        await fetchSourceText(
          candidate.sourceUrl,
        );

      const exactMatch =
        exactQuoteExists(
          candidate.originalText,
          source.text,
        );

      results.push({
        ...candidate,

        exactMatch,

        trustedSource:
          Boolean(trustedSource),

        trustLevel:
          trustedSource?.trustLevel ?? null,

        trustedSourceType:
          trustedSource?.sourceType ?? null,

        verificationError: null,
      });
    } catch (error) {
      results.push({
        ...candidate,

        exactMatch: false,

        trustedSource:
          Boolean(trustedSource),

        trustLevel:
          trustedSource?.trustLevel ?? null,

        trustedSourceType:
          trustedSource?.sourceType ?? null,

        verificationError:
          error instanceof Error
            ? error.message
            : "Unknown verification error.",
      });
    }
  }

  return results;
}
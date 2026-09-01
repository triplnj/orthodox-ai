import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  discoverPatristicSources,
} from "@/lib/patristics/web-discovery";

import {
  verifyDiscoveryCandidates,
} from "@/lib/patristics/verify-discovery";

import {
  verifyCandidateAttribution,
} from "@/lib/patristics/verify-attribution";

import {
  saveVerifiedDiscoveryCandidate,
} from "@/lib/patristics/save-quotes";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-patristics-secret",
    );

  if (
    !process.env.PATRISTICS_SECRET ||
    secret !==
      process.env.PATRISTICS_SECRET
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request.json();

  const query =
    typeof body.query === "string"
      ? body.query.trim()
      : "";

  if (!query) {
    return NextResponse.json(
      {
        error: "Missing query.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const discovered =
      await discoverPatristicSources({
        query,
        language: "en",
      });

    const verified =
      await verifyDiscoveryCandidates(
        discovered,
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

    const savedResults =
      await Promise.all(
        attributionVerified.map(
          async (candidate) => {
            const saved =
              await saveVerifiedDiscoveryCandidate(
                candidate,
                candidate.attribution,
              );

            return {
              candidate,
              saved: {
                id: saved.id,
                verification:
                  saved.verification,
                confidence:
                  saved.confidence,
              },
            };
          },
        ),
      );

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error(
      "PATRISTIC_DISCOVERY_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Patristic discovery failed.",
      },
      {
        status: 500,
      },
    );
  }
}
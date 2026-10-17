import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextResponse } from "next/server";
import { detectPatristicLanguage } from "@/lib/patristics/detect-language";
import { discoverAndSavePatristicQuotes } from "@/lib/patristics/discover-and-save";
import { verifyQuotesAgainstPg } from "@/lib/patristics/verify-second-source";
import { embedVerifiedQuotes } from "@/lib/patristics/embed-quotes";

async function handleResearch(req: Request) {
  try {

    const body = await req.json();

    const query =
      typeof body.query === "string"
        ? body.query.trim()
        : "";

    if (!query) {
      return NextResponse.json(
        {
          error: "Query is required.",
        },
        {
          status: 400,
        },
      );
    }

    const language =
      detectPatristicLanguage(query);

    const discoveryResult =
      await discoverAndSavePatristicQuotes(
        query,
        language,
      );

    const discoveredQuoteIds =
      discoveryResult.result.map(
        (item) => item.saved.id,
      );

    console.log(
      "PATRISTIC_BACKGROUND_DISCOVERY:",
      {
        query,
        discovered:
          discoveryResult.discovered,
        exactMatches:
          discoveryResult.exactMatches,
        trustedExactMatches:
          discoveryResult.trustedExactMatches,
        attributionVerified:
          discoveryResult.attributionVerified,
        saved:
          discoveryResult.saved,
        quoteIds:
          discoveredQuoteIds,
      },
    );

    let secondSourceResult = null;
    let embeddingResult = null;

    if (discoveredQuoteIds.length > 0) {
      secondSourceResult =
        await verifyQuotesAgainstPg(
          discoveredQuoteIds,
        );

      console.log(
        "PATRISTIC_BACKGROUND_SECOND_SOURCE:",
        secondSourceResult,
      );

      if (secondSourceResult.matched > 0) {
        embeddingResult =
          await embedVerifiedQuotes(
            discoveredQuoteIds,
          );

        console.log(
          "PATRISTIC_BACKGROUND_EMBEDDING:",
          embeddingResult,
        );
      }
    }

    return NextResponse.json({
      ok: true,

      query,

      discovered:
        discoveryResult.discovered,

      saved:
        discoveryResult.saved,

      secondSourceMatched:
        secondSourceResult?.matched ?? 0,

      embedded:
        embeddingResult?.embedded ?? 0,
    });
  } catch (error) {
    console.error(
      "PATRISTIC_BACKGROUND_DISCOVERY_ERROR:",
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
export const POST = secureResearchRoute(handleResearch, false);

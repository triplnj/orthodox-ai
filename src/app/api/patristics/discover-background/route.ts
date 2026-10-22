import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
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
      return apiJson(
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

    diagnostic("operation_completed", { operation: "discovery", count: discoveryResult.saved });

    let secondSourceResult = null;
    let embeddingResult = null;

    if (discoveredQuoteIds.length > 0) {
      secondSourceResult =
        await verifyQuotesAgainstPg(
          discoveredQuoteIds,
        );

      diagnostic("operation_completed", { operation: "verification" });

      if (secondSourceResult.matched > 0) {
        embeddingResult =
          await embedVerifiedQuotes(
            discoveredQuoteIds,
          );

        diagnostic("operation_completed", { operation: "embedding" });
      }
    }

    return apiJson({
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
    diagnostic("operation_failed", { operation: "discovery", failure: failureCategory(error) });

    return apiJson(
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

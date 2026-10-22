import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { backfillPatristicTranslations } from "@/lib/patristics/backfill-translations";

async function handleResearch() {

  try {
    const result =
      await backfillPatristicTranslations();

    return apiJson(result);
  } catch (error) {
    diagnostic("operation_failed", { operation: "translation", failure: failureCategory(error) });

    return apiJson(
      {
        error: "Translation backfill failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch);

import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  repairCorruptedQuotes,
} from "@/lib/patristics/repair-corrupted-quotes";


async function handleResearch(
  ) {


  try {
    const result =
      await repairCorruptedQuotes();

    return apiJson(
      result,
    );
  } catch (error) {
    diagnostic("operation_failed", { operation: "verification", failure: failureCategory(error) });

    return apiJson(
      {
        error: "The repair operation could not be completed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch);

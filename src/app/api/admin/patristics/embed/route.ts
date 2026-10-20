import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  embedVerifiedQuotes,
} from "@/lib/patristics/embed-quotes";


export const runtime = "nodejs";


async function handleResearch(
  ) {
  try {


    const result =
      await embedVerifiedQuotes();


    return apiJson(
      result,
    );

  } catch (error) {

    diagnostic("operation_failed", { operation: "embedding", failure: failureCategory(error) });


    return apiJson(
      {
        error:
          "Embedding generation failed",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch);

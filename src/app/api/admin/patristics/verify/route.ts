import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  verifyQuotesAgainstPg,
} from "@/lib/patristics/verify-second-source";


export const runtime =
  "nodejs";


async function handleResearch(
  ) {
  try {


    const result =
      await verifyQuotesAgainstPg();


    return apiJson(
      result,
    );

  } catch (error) {

    diagnostic("operation_failed", { operation: "verification", failure: failureCategory(error) });


    return apiJson(
      {
        error:
          "PG verification failed",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch);

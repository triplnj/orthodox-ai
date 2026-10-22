import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextRequest }
  from "next/server";

import { collectFromSource }
  from "@/lib/patristics/collect";

export const runtime = "nodejs";

async function handleResearch(
  request: NextRequest,
) {
  try {

    const body =
      await request.json();

    const url =
      String(body.url ?? "");

    if (
      !url.startsWith("https://")
    ) {
      return apiJson(
        {
          error:
            "Valid HTTPS URL required",
        },
        {
          status: 400,
        },
      );
    }

    const result =
      await collectFromSource(url);

    return apiJson(
      result,
    );
  } catch (error) {

    diagnostic("operation_failed", { operation: "extraction", failure: failureCategory(error) });

    return apiJson(
      {
        error:
          "Patristic collection failed",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch);

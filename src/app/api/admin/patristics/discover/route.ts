import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextRequest } from "next/server";

import {
  discoverAndSavePatristicQuotes,
} from "@/lib/patristics/discover-and-save";

export const runtime = "nodejs";

async function handleResearch(
  request: NextRequest,
) {

  const body =
    await request.json();

  const query =
    typeof body.query === "string"
      ? body.query.trim()
      : "";

  const language =
    body.language === "sr"
      ? "sr"
      : "en";

  if (!query) {
    return apiJson(
      {
        error: "Missing query.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result =
      await discoverAndSavePatristicQuotes(
        query,
        language,
      );

    return apiJson(
      result,
    );
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
export const POST = secureResearchRoute(handleResearch);

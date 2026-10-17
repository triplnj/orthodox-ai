import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  NextRequest,
  NextResponse,
} from "next/server";

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
    const result =
      await discoverAndSavePatristicQuotes(
        query,
        language,
      );

    return NextResponse.json(
      result,
    );
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
export const POST = secureResearchRoute(handleResearch);

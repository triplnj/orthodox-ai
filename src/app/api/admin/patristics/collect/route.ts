import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextRequest, NextResponse }
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
      return NextResponse.json(
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

    return NextResponse.json(
      result,
    );
  } catch (error) {

    console.error(
      "PATRISTICS_COLLECT_ERROR",
      error,
    );

    return NextResponse.json(
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

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  discoverAndSavePatristicQuotes,
} from "@/lib/patristics/discover-and-save";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-patristics-secret",
    );

  if (
    !process.env.PATRISTICS_SECRET ||
    secret !==
      process.env.PATRISTICS_SECRET
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

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
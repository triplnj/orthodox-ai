import { NextRequest, NextResponse } from "next/server";

import { backfillPatristicTranslations } from "@/lib/patristics/backfill-translations";

export async function POST(request: NextRequest) {
  const secret = request.headers.get(
    "x-patristics-secret",
  );

  if (
    !process.env.PATRISTICS_SECRET ||
    secret !== process.env.PATRISTICS_SECRET
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

  try {
    const result =
      await backfillPatristicTranslations();

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Patristic translation backfill failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "Translation backfill failed.",
      },
      {
        status: 500,
      },
    );
  }
}
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  repairCorruptedQuotes,
} from "@/lib/patristics/repair-corrupted-quotes";


export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-patristics-secret",
    );

  if (
    secret !==
    process.env.PATRISTICS_SECRET
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }


  try {
    const result =
      await repairCorruptedQuotes();

    return NextResponse.json(
      result,
    );
  } catch (error) {
    console.error(
      "PATRISTIC_QUOTE_REPAIR_FAILED",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown repair error.",
      },
      {
        status: 500,
      },
    );
  }
}
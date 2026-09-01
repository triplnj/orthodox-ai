import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  verifyQuotesAgainstPg,
} from "@/lib/patristics/verify-second-source";


export const runtime =
  "nodejs";


export async function POST(
  request: NextRequest,
) {
  try {

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
          error:
            "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }


    const result =
      await verifyQuotesAgainstPg();


    return NextResponse.json(
      result,
    );

  } catch (error) {

    console.error(
      "PATRISTICS_PG_VERIFY_ERROR",
      error,
    );


    return NextResponse.json(
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
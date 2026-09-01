import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  embedVerifiedQuotes,
} from "@/lib/patristics/embed-quotes";


export const runtime = "nodejs";


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
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }


    const result =
      await embedVerifiedQuotes();


    return NextResponse.json(
      result,
    );

  } catch (error) {

    console.error(
      "PATRISTICS_EMBED_ERROR",
      error,
    );


    return NextResponse.json(
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
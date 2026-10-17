import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  NextResponse,
} from "next/server";

import {
  embedVerifiedQuotes,
} from "@/lib/patristics/embed-quotes";


export const runtime = "nodejs";


async function handleResearch(
  ) {
  try {


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
export const POST = secureResearchRoute(handleResearch);

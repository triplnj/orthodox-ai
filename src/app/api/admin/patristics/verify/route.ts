import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  NextResponse,
} from "next/server";

import {
  verifyQuotesAgainstPg,
} from "@/lib/patristics/verify-second-source";


export const runtime =
  "nodejs";


async function handleResearch(
  ) {
  try {


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
export const POST = secureResearchRoute(handleResearch);

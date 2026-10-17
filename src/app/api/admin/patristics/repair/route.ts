import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  NextResponse,
} from "next/server";

import {
  repairCorruptedQuotes,
} from "@/lib/patristics/repair-corrupted-quotes";


async function handleResearch(
  ) {


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
export const POST = secureResearchRoute(handleResearch);

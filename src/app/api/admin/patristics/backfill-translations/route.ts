import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextResponse } from "next/server";

import { backfillPatristicTranslations } from "@/lib/patristics/backfill-translations";

async function handleResearch() {

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
export const POST = secureResearchRoute(handleResearch);

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { processNextPatristicDiscoveryJob } from "@/lib/patristics/process-discovery-job";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const result =
      await processNextPatristicDiscoveryJob();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "PATRISTIC_PROCESS_JOB_TEST_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 },
    );
  }
}
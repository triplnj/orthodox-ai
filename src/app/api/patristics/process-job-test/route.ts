import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { processPatristicDiscoveryJob } from "@/lib/patristics/process-discovery-job";

export async function POST(
  request: Request,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const jobId =
      typeof body?.jobId === "string"
        ? body.jobId.trim()
        : "";

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required." },
        { status: 400 },
      );
    }

    const result =
      await processPatristicDiscoveryJob(
        jobId,
      );

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
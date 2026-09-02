import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import { start } from "workflow/api";

import { patristicDiscoveryWorkflow } from "@/workflows/patristic-discovery";

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

  const run = await start(
    patristicDiscoveryWorkflow,
    [jobId],
  );

  return NextResponse.json({
    ok: true,
    jobId,
    runId: run.runId,
  });
}
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const job =
    await prisma.patristicDiscoveryJob.findUnique({
      where: {
        id: jobId,
      },
    });

  if (!job) {
    return NextResponse.json(
      { error: "Discovery job not found." },
      { status: 404 },
    );
  }

  const language =
    job.language === "sr"
      ? "sr"
      : "en";

  const run = await start(
    patristicDiscoveryWorkflow,
    [
      job.id,
      job.query,
      language,
    ],
  );

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    query: job.query,
    language,
    runId: run.runId,
  });
}
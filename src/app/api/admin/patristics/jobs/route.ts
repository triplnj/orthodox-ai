import { NextRequest, NextResponse } from "next/server";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { enqueuePatristicDiscovery } from "@/lib/patristics/enqueue-discovery";
import { dispatchPatristicJob } from "@/lib/patristics/dispatch-job";

async function handleJobs(request: NextRequest) {
  const body = await request.json();
  const job = body.jobId ? { id: body.jobId as string } : await enqueuePatristicDiscovery({
    query: typeof body.query === "string" ? body.query : "", language: body.language === "sr" ? "sr" : "en",
  });
  if (!job) return NextResponse.json({ error: "Query or jobId is required." }, { status: 400 });
  return NextResponse.json(await dispatchPatristicJob(job.id));
}

export const POST = secureResearchRoute(handleJobs);

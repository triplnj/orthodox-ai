import { apiJson } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { enqueuePatristicDiscovery } from "@/lib/patristics/enqueue-discovery";
import { dispatchPatristicJob } from "@/lib/patristics/dispatch-job";

async function handleJobs(request: NextRequest) {
  const body = await request.json();
  const job = body.jobId ? { id: body.jobId as string } : await enqueuePatristicDiscovery({
    query: typeof body.query === "string" ? body.query : "", language: body.language === "sr" ? "sr" : "en",
  });
  if (!job) return apiJson({ error: "Query or jobId is required." }, { status: 400 });
  return apiJson(await dispatchPatristicJob(job.id));
}

export const POST = secureResearchRoute(handleJobs);

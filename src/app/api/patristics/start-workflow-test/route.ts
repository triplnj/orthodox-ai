import { apiJson } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { dispatchPatristicJob } from "@/lib/patristics/dispatch-job";

async function handleResearch(request: NextRequest) {
  const body = await request.json();
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) return apiJson({ error: "jobId is required." }, { status: 400 });
  return apiJson(await dispatchPatristicJob(jobId));
}
export const POST = secureResearchRoute(handleResearch, true);

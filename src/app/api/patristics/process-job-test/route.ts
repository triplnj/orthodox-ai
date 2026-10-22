import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import { processPatristicDiscoveryJob } from "@/lib/patristics/process-discovery-job";

async function handleResearch(
  request: Request,
) {

  try {
    const body = await request.json();

    const jobId =
      typeof body?.jobId === "string"
        ? body.jobId.trim()
        : "";

    if (!jobId) {
      return apiJson(
        { error: "jobId is required." },
        { status: 400 },
      );
    }

    const result =
      await processPatristicDiscoveryJob(
        jobId,
      );

    return apiJson({
      ok: true,
      result,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "research", failure: failureCategory(error) });

    return apiJson(
      {
        ok: false,
        error: "The research operation could not be completed.",
      },
      { status: 500 },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

import { processPatristicDiscoveryJob } from "@/lib/patristics/process-discovery-job";

export async function patristicDiscoveryWorkflow(
  jobId: string,
) {
  "use workflow";

  return await processPatristicDiscoveryJobStep(
    jobId,
  );
}

async function processPatristicDiscoveryJobStep(
  jobId: string,
) {
  "use step";

  console.log(
    "PATRISTIC_WORKFLOW_JOB_ID:",
    jobId,
  );

  return await processPatristicDiscoveryJob(
    jobId,
  );
}
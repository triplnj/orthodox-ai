import { processNextPatristicDiscoveryJob } from "@/lib/patristics/process-discovery-job";

export async function patristicDiscoveryWorkflow() {
  "use workflow";

  return await processPatristicDiscoveryJobStep();
}

async function processPatristicDiscoveryJobStep() {
  "use step";

  return await processNextPatristicDiscoveryJob();
}
import { discoverPatristicSourceUrls } from "@/lib/patristics/discover-and-save";

export async function patristicDiscoveryWorkflow(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use workflow";

  return await discoverSourcesStep(
    jobId,
    query,
    language,
  );
}

async function discoverSourcesStep(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use step";

  console.log(
    "PATRISTIC_WORKFLOW_DISCOVERY_START:",
    {
      jobId,
      query,
      language,
    },
  );

  const result =
    await discoverPatristicSourceUrls(
      query,
      language,
    );

  console.log(
    "PATRISTIC_WORKFLOW_DISCOVERY_RESULT:",
    {
      jobId,
      discovered: result.discovered,
      sourceUrls: result.sourceUrls,
    },
  );

  return {
    jobId,
    ...result,
  };
}
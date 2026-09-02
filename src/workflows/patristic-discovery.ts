import { discoverPatristicSourceUrls } from "@/lib/patristics/discover-and-save";
import { fetchSourceText } from "@/lib/patristics/fetch-source";

export async function patristicDiscoveryWorkflow(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use workflow";

  const discovery =
    await discoverSourcesStep(
      jobId,
      query,
      language,
    );

  if (
    discovery.sourceUrls.length === 0
  ) {
    return {
      jobId,
      discovered:
        discovery.discovered,
      sourceUrls: [],
      fetched: null,
    };
  }

  const fetched =
    await fetchSourceStep(
      jobId,
      discovery.sourceUrls[0],
    );

  return {
    jobId,
    discovered:
      discovery.discovered,
    sourceUrls:
      discovery.sourceUrls,
    fetched,
  };
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
      discovered:
        result.discovered,
      sourceUrls:
        result.sourceUrls,
    },
  );

  return {
    jobId,
    ...result,
  };
}

async function fetchSourceStep(
  jobId: string,
  sourceUrl: string,
) {
  "use step";

  console.log(
    "PATRISTIC_WORKFLOW_FETCH_START:",
    {
      jobId,
      sourceUrl,
    },
  );

  const source =
    await fetchSourceText(
      sourceUrl,
    );

  const result = {
    sourceUrl,
    title: source.title,
    textLength:
      source.text.length,
    hasText:
      source.text.length > 0,
  };

  console.log(
    "PATRISTIC_WORKFLOW_FETCH_RESULT:",
    {
      jobId,
      ...result,
    },
  );

  return result;
}
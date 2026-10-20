import { randomUUID } from "node:crypto";
import { claimPatristicJob, finishPatristicJob } from "./job-claims";
import { prisma } from "@/lib/prisma";
import { safeResearchFailure } from "@/lib/diagnostics";

import { discoverAndSavePatristicQuotes } from "./discover-and-save";
import { verifyQuotesAgainstPg } from "./verify-second-source";
import { embedVerifiedQuotes } from "./embed-quotes";

export async function processPatristicDiscoveryJob(
  jobId: string,
) {
  const job =
    await prisma.patristicDiscoveryJob.findUnique({
      where: {
        id: jobId,
      },
    });

  if (!job) {
    return {
      processed: false,
      reason: "JOB_NOT_FOUND",
    };
  }

  const owner = randomUUID();
  if (!(await claimPatristicJob(jobId, owner))) {
    return { processed: false, reason: "JOB_NOT_PROCESSABLE" };
  }

  try {
    const language =
      job.language === "sr"
        ? "sr"
        : "en";

    const discoveryResult =
      await discoverAndSavePatristicQuotes(
        job.query,
        language,
      );

    const quoteIds =
      discoveryResult.result.map(
        (item) => item.saved.id,
      );

    let secondSourceMatched = 0;
    let embedded = 0;

    if (quoteIds.length > 0) {
      const secondSourceResult =
        await verifyQuotesAgainstPg(
          quoteIds,
        );

      secondSourceMatched =
        secondSourceResult.matched;

      if (secondSourceMatched > 0) {
        const embeddingResult =
          await embedVerifiedQuotes(
            quoteIds,
          );

        embedded =
          embeddingResult.embedded;
      }
    }

    await finishPatristicJob(job.id, owner);

    return {
      processed: true,
      jobId: job.id,
      discovered: discoveryResult.discovered,
      saved: discoveryResult.saved,
      secondSourceMatched,
      embedded,
    };
  } catch (error) {
    const message = safeResearchFailure(error);

    await finishPatristicJob(job.id, owner, message);

    throw new Error(message);
  }
}

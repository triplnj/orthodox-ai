import { prisma } from "@/lib/prisma";

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

  if (
    job.status !== "PENDING" &&
    job.status !== "PROCESSING"
  ) {
    return {
      processed: false,
      reason: "JOB_NOT_PROCESSABLE",
      status: job.status,
    };
  }

  if (job.status === "PENDING") {
    await prisma.patristicDiscoveryJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "PROCESSING",
        attempts: {
          increment: 1,
        },
        startedAt: new Date(),
        error: null,
      },
    });
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

    await prisma.patristicDiscoveryJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });

    return {
      processed: true,
      jobId: job.id,
      discovered: discoveryResult.discovered,
      saved: discoveryResult.saved,
      secondSourceMatched,
      embedded,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown discovery error.";

    await prisma.patristicDiscoveryJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "FAILED",
        error: message,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
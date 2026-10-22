import { prisma } from "@/lib/prisma";

type EnqueuePatristicDiscoveryInput = {
  query: string;
  language: string;
};

export async function enqueuePatristicDiscovery({
  query,
  language,
}: EnqueuePatristicDiscoveryInput) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"discovery:" + language + ":" + normalizedQuery}, 0))`;
    const existingJob =
      await tx.patristicDiscoveryJob.findFirst({
        where: {
          query: normalizedQuery,
          language,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (existingJob) {
      return existingJob;
    }

    return tx.patristicDiscoveryJob.create({
      data: {
        query: normalizedQuery,
        language,
        status: "PENDING",
      },
    });
  }, { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 15_000 });
}

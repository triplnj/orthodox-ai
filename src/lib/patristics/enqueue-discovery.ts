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

  const existingJob =
    await prisma.patristicDiscoveryJob.findFirst({
      where: {
        query: normalizedQuery,
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

  return prisma.patristicDiscoveryJob.create({
    data: {
      query: normalizedQuery,
      language,
      status: "PENDING",
    },
  });
}
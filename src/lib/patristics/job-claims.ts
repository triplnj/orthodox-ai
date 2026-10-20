import "server-only";
import { prisma } from "@/lib/prisma";
import { persistedResearchFailure } from "@/lib/diagnostics";

/** Only the same durable workflow owner may resume an existing claim. */
export async function claimPatristicJob(jobId: string, owner: string, resume = false) {
  const result = await prisma.patristicDiscoveryJob.updateMany({
    where: { id: jobId, status: "PENDING", claimToken: null },
    data: { status: "PROCESSING", claimToken: owner, attempts: { increment: 1 },
      startedAt: new Date(), finishedAt: null, error: null },
  });
  if (result.count === 1) return true;
  if (!resume) return false;
  return Boolean(await prisma.patristicDiscoveryJob.findFirst({
    where: { id: jobId, status: "PROCESSING", claimToken: owner }, select: { id: true },
  }));
}

export async function finishPatristicJob(jobId: string, owner: string, error?: string) {
  await prisma.patristicDiscoveryJob.updateMany({
    where: { id: jobId, status: "PROCESSING", claimToken: owner },
    data: { status: error === undefined ? "COMPLETED" : "FAILED", finishedAt: new Date(), error: error === undefined ? null : persistedResearchFailure(error) },
  });
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { start } from "workflow/api";
import { patristicDiscoveryWorkflow } from "@/workflows/patristic-discovery";
import { AiInputError } from "@/lib/ai/requestSecurity";

export async function dispatchPatristicJob(jobId: string) {
  const job = await prisma.patristicDiscoveryJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AiInputError("Discovery job not found.", 404);
  const dispatch = await prisma.patristicDiscoveryJob.updateMany({
    where: { id: jobId, status: "PENDING", dispatchedAt: null }, data: { dispatchedAt: new Date() },
  });
  if (dispatch.count !== 1) throw new AiInputError("Job is already dispatched or processed.", 409);
  const language = job.language === "sr" ? "sr" : "en";
  // Keep dispatchedAt on ambiguous failures: never blindly submit twice.
  const run = await start(patristicDiscoveryWorkflow, [job.id, job.query, language]);
  return { ok: true, jobId: job.id, query: job.query, language, runId: run.runId };
}

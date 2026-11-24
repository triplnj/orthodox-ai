import "server-only";
import { prisma } from "@/lib/prisma";
import { retrieveVerifiedPaddleSandboxAccess } from "./paddle-provider-evidence";

/**
 * Preview-only read-through access check. No cached Paddle record alone can
 * grant access: verify current subscription + paid transaction against API.
 * A provider outage fails closed (in Sandbox only).
 */
export async function getPaddleSandboxPreviewAccess(userId: string): Promise<Date | null> {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120" ||
      process.env.PADDLE_SANDBOX_GRANT_ACCESS !== "enabled") return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ subscriptionId: string }>>`
      SELECT a."subscriptionId" FROM "PaddleSandboxAccess" a
      WHERE a."userId" = ${userId} AND a."status" = 'active'
      AND a."periodEndsAt" > CURRENT_TIMESTAMP
      AND EXISTS (SELECT 1 FROM "PaddleSandboxBranchGuard"
        WHERE "id" = 'br-red-waterfall-asdlxovu')
      LIMIT 5`;
    let until: Date | null = null;
    for (const row of rows) {
      const proof = await retrieveVerifiedPaddleSandboxAccess(row.subscriptionId);
      if (proof?.userId === userId &&
          (!until || proof.periodEndsAt > until)) until = proof.periodEndsAt;
    }
    return until;
  } catch {
    return null;
  }
}

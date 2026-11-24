import "server-only";
import { prisma } from "@/lib/prisma";
import type { VerifiedPaddleSandboxAccess } from "./paddle-paid-evidence";

const QA_BRANCH_ID = "br-red-waterfall-asdlxovu";

/**
 * Sandbox-only access record; does not write User.plan or legacy provider rows.
 * A verified Paddle API receipt is mandatory before calling this function.
 */
export async function saveVerifiedPaddleSandboxAccess(evidence: VerifiedPaddleSandboxAccess) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120" ||
      process.env.PADDLE_SANDBOX_GRANT_ACCESS !== "enabled") {
    throw new Error("Paddle Sandbox entitlement writes are disabled.");
  }
  if (evidence.periodEndsAt <= new Date()) throw new Error("Expired Paddle paid period.");
  await prisma.$transaction(async tx => {
    const guard = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaddleSandboxBranchGuard"
      WHERE "id" = ${QA_BRANCH_ID} LIMIT 1`;
    if (guard.length !== 1) throw new Error("Wrong Paddle QA database.");

    // Serialize access changes for the same customer and subscription.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paddle-customer:${evidence.customerId}`}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paddle-sub:${evidence.subscriptionId}`}, 0))`;

    const users = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${evidence.userId}
      AND "emailVerified" IS NOT NULL
      AND "billingDeletionRequestedAt" IS NULL LIMIT 1`;
    if (users.length !== 1) throw new Error("Checkout owner is not a verified active account.");

    const conflicts = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId" FROM "PaddleSandboxAccess"
      WHERE "customerId" = ${evidence.customerId}
      AND "userId" <> ${evidence.userId} LIMIT 1`;
    if (conflicts.length) throw new Error("Paddle customer ownership conflict.");

    const updated = await tx.$queryRaw<Array<{ subscriptionId: string }>>`
      INSERT INTO "PaddleSandboxAccess"
        ("subscriptionId", "userId", "customerId", "paidTransactionId", "periodEndsAt", "verifiedAt", "status")
      VALUES (${evidence.subscriptionId}, ${evidence.userId}, ${evidence.customerId},
        ${evidence.paidTransactionId}, ${evidence.periodEndsAt}, CURRENT_TIMESTAMP, 'active')
      ON CONFLICT ("subscriptionId") DO UPDATE SET
        "paidTransactionId" = EXCLUDED."paidTransactionId",
        "periodEndsAt" = EXCLUDED."periodEndsAt",
        "verifiedAt" = CURRENT_TIMESTAMP, "status" = 'active'
      WHERE "PaddleSandboxAccess"."userId" = EXCLUDED."userId"
        AND "PaddleSandboxAccess"."customerId" = EXCLUDED."customerId"
      RETURNING "subscriptionId"`;
    if (updated.length !== 1) throw new Error("Paddle subscription ownership conflict.");
  }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
}

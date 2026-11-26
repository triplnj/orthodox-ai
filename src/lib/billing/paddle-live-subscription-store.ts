import "server-only";
import { prisma } from "@/lib/prisma";
import type { VerifiedPaddleLivePayment } from "./paddle-live-evidence";

/** Store verified payment facts in separate Live ledger, never user.plan. */
export async function saveVerifiedPaddleLivePayment(payment: VerifiedPaddleLivePayment) {
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled" ||
     process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled")
   throw Error("Paddle Live reconciliation disabled.");
 if (payment.periodEndsAt <= new Date()) throw Error("Expired payment proof.");
 await prisma.$transaction(async tx => {
   // Lock both identities before checking ownership and recording evidence.
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`paddle-live-customer:${payment.customerId}`},0))`;
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`paddle-live-sub:${payment.subscriptionId}`},0))`;
   const users = await tx.$queryRaw<Array<{ id: string }>>`
     SELECT "id" FROM "users" WHERE "id" = ${payment.userId}
       AND "emailVerified" IS NOT NULL
       AND "billingDeletionRequestedAt" IS NULL LIMIT 1`;
   if (users.length !== 1) throw Error("Live account owner unavailable.");
   const customerOwners = await tx.$queryRaw<Array<{ userId: string | null }>>`
     SELECT "userId" FROM "PaddleLiveSubscription"
       WHERE "customerId" = ${payment.customerId}
       AND ("userId" IS NULL OR "userId" <> ${payment.userId}) LIMIT 1`;
   if (customerOwners.length) throw Error("Paddle Live customer ownership conflict.");
   const existing = await tx.$queryRaw<Array<{ userId: string | null; customerId: string }>>`
     SELECT "userId","customerId" FROM "PaddleLiveSubscription"
       WHERE "subscriptionId" = ${payment.subscriptionId} LIMIT 1`;
   if (existing.length && (existing[0].userId !== payment.userId ||
       existing[0].customerId !== payment.customerId))
     throw Error("Paddle Live subscription ownership conflict.");
   const updated = await tx.$queryRaw<Array<{ subscriptionId: string }>>`
     INSERT INTO "PaddleLiveSubscription"
       ("subscriptionId","customerId","userId","productId","priceId","status",
        "periodEndsAt","paidTransactionId","verifiedAt","cancelAtPeriodEnd")
     VALUES (${payment.subscriptionId},${payment.customerId},${payment.userId},
       ${payment.productId},${payment.priceId},'active',
       ${payment.periodEndsAt},${payment.paidTransactionId},CURRENT_TIMESTAMP,${payment.cancelAtPeriodEnd})
     ON CONFLICT ("subscriptionId") DO UPDATE SET
       "periodEndsAt" = EXCLUDED."periodEndsAt",
       "paidTransactionId" = EXCLUDED."paidTransactionId",
       "verifiedAt" = CURRENT_TIMESTAMP,
       "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
       "status" = 'active',
       "updatedAt" = CURRENT_TIMESTAMP
     WHERE "PaddleLiveSubscription"."userId" = EXCLUDED."userId"
       AND "PaddleLiveSubscription"."customerId" = EXCLUDED."customerId"
     RETURNING "subscriptionId"`;
   if (updated.length !== 1) throw Error("Live subscription write conflict.");
 }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { retrieveVerifiedPaddleLivePayment } from "./paddle-live-provider";

/** Read-through paid access overlay; never trusts an unaudited webhook alone. */
export async function getPaddleLiveAccess(userId: string): Promise<Date | null> {
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled") return null;
 try {
   const rows = await prisma.$queryRaw<Array<{
     subscriptionId: string; customerId: string; paidTransactionId: string;
   }>>`
     SELECT "subscriptionId", "customerId", "paidTransactionId"
     FROM "PaddleLiveSubscription"
     WHERE "userId" = ${userId} AND "status" = 'active'
       AND "periodEndsAt" > CURRENT_TIMESTAMP AND "verifiedAt" IS NOT NULL
       AND "paidTransactionId" IS NOT NULL
     LIMIT 5`;
   let latest: Date | null = null;
   for (const row of rows) {
     const verified = await retrieveVerifiedPaddleLivePayment(row.subscriptionId);
     if (!verified || verified.userId !== userId ||
         verified.customerId !== row.customerId ||
         verified.periodEndsAt <= new Date() ||
         verified.paidTransactionId !== row.paidTransactionId) continue;
     if (!latest || latest < verified.periodEndsAt) latest = verified.periodEndsAt;
   }
   return latest;
 } catch {
   return null;
 }
}

import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

type LiveNotice = {
 event_id: string;
 event_type: string;
 occurred_at?: unknown;
 data: Record<string, unknown>;
};
const relevant = new Set([
 "transaction.completed", "transaction.payment_failed", "transaction.past_due",
 "subscription.created", "subscription.activated", "subscription.updated",
 "subscription.canceled", "subscription.past_due", "subscription.paused",
 "subscription.resumed", "adjustment.created", "adjustment.updated",
]);

/**
 * Audits signed Live events; deliberately does NOT confer entitlements.
 * Requires a separate reviewed migration and explicit Live webhook flag.
 * The provider payload is never stored; only a digest and event metadata.
 */
export async function recordPaddleLiveEvent(raw: string, event: LiveNotice) {
 const eventId = event.event_id;
 const eventType = event.event_type;
 if (!/^evt_[a-z0-9]{26}$/.test(eventId) || !relevant.has(eventType))
   return "ignored" as const;
 const data = event.data;
 const value = eventType.startsWith("subscription.") ? data.id :
   eventType.startsWith("transaction.") ? data.subscription_id :
   data.subscription_id;
 const subscriptionId = typeof value === "string" && /^sub_[a-z0-9]{26}$/.test(value) ? value : null;
 const parsed = typeof event.occurred_at === "string" ? new Date(event.occurred_at) : null;
 const occurredAt = parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
 const digest = createHash("sha256").update(raw, "utf8").digest("hex");
 return prisma.$transaction(async tx => {
   const previous = await tx.$queryRaw<Array<{ eventType: string; payloadDigest: string }>>`
     SELECT "eventType", "payloadDigest" FROM "PaddleLiveEvent"
     WHERE "eventId" = ${eventId}`;
   if (previous.length) {
     if (previous.length !== 1 || previous[0].eventType !== eventType ||
         previous[0].payloadDigest !== digest) throw Error("Paddle Live event collision");
     return "duplicate" as const;
   }
   // Atomic idempotency. Concurrent duplicates are only acknowledged after
   // validating persisted event type/digest against the same immutable event ID.
   const inserted = await tx.$queryRaw<Array<{ eventId: string }>>`
     INSERT INTO "PaddleLiveEvent" ("eventId","eventType","subscriptionId","payloadDigest","occurredAt")
     VALUES (${eventId},${eventType},${subscriptionId},${digest},${occurredAt})
     ON CONFLICT ("eventId") DO NOTHING RETURNING "eventId"`;
   if (inserted.length === 1) return "inserted" as const;
   const collision = await tx.$queryRaw<Array<{ eventType: string; payloadDigest: string }>>`
     SELECT "eventType","payloadDigest" FROM "PaddleLiveEvent" WHERE "eventId" = ${eventId}`;
   if (collision.length !== 1 || collision[0].eventType !== eventType ||
       collision[0].payloadDigest !== digest) throw Error("Paddle Live event collision");
   return "duplicate" as const;
 }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
}

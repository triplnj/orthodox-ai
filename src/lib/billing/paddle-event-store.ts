import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const QA_BRANCH_ID = "br-red-waterfall-asdlxovu";
const PROVIDER = "PADDLE";

type PaddleEnvelope = {
  event_id: string;
  event_type: string;
  occurred_at?: unknown;
  data: Record<string, unknown>;
};

/** Store only audit metadata; never persist raw customer/payment JSON. */
export async function persistPaddleSandboxEvent(raw: string, event: PaddleEnvelope):
  Promise<"inserted" | "duplicate"> {
  const digest = createHash("sha256").update(raw, "utf8").digest("hex");
  const id = event.event_id;
  const eventType = event.event_type;
  const occurred = typeof event.occurred_at === "string" ? new Date(event.occurred_at) : null;
  const occurredAt = occurred && Number.isFinite(occurred.getTime()) ? occurred : null;
  const data = event.data;
  const sub = eventType.startsWith("subscription.") ? data.id :
    eventType.startsWith("transaction.") ? data.subscription_id : null;
  const subscriptionId = typeof sub === "string" && /^sub_[a-z0-9]{4,70}$/.test(sub) ? sub : null;

  return prisma.$transaction(async tx => {
    // This guard table is deliberately created ONLY on the isolated Neon QA branch.
    // A production or mismatched DB fails closed before any write.
    const branch = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaddleSandboxBranchGuard"
      WHERE "id" = ${QA_BRANCH_ID} LIMIT 1`;
    if (branch.length !== 1) throw new Error("Paddle QA database guard mismatch");

    const result = await tx.billingWebhookEvent.createMany({
      data: [{
        provider: PROVIDER, eventId: id, eventType,
        providerSubscriptionId: subscriptionId,
        payloadDigest: digest, occurredAt,
        status: "RECEIVED",
      }],
      skipDuplicates: true,
    });

    if (result.count === 1) return "inserted" as const;
    const existing = await tx.billingWebhookEvent.findUnique({
      where: { provider_eventId: { provider: PROVIDER, eventId: id } },
      select: { eventType: true, payloadDigest: true },
    });
    if (!existing || existing.eventType !== eventType ||
        existing.payloadDigest !== digest) {
      throw new Error("Paddle event id collision");
    }
    return "duplicate" as const;
  }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
}

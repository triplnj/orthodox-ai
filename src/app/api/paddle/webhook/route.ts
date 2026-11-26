import { NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPaddleWebhookSignature } from "@/lib/billing/paddle-signature";
import { paddleApi, paddleSubscription } from "@/lib/billing/paddle-provider";
import { webhook } from "@/lib/billing/service";

export const runtime = "nodejs";
type PaddleEvent = { event_id?: string; event_type?: string; occurred_at?: string;
  data?: { id?: string; customer_id?: string; transaction_id?: string | null;
    custom_data?: { userId?: string; billingAttemptId?: string; binding?: string } | null } };
type Transaction = { id?: string; subscription_id?: string | null; customer_id?: string | null;
  status?: string; custom_data?: { userId?: string; billingAttemptId?: string; binding?: string } | null;
  items?: Array<{ price?: { id?: string }; quantity?: number }> };
const allowed = new Set(["subscription.created", "subscription.updated", "subscription.activated",
  "subscription.canceled", "subscription.paused", "subscription.resumed", "subscription.past_due"]);

function compareBinding(userId: string, attemptId: string, value: string | undefined) {
  const secret = process.env.PADDLE_LIVE_BINDING_SECRET;
  if (!secret || !value || !/^[0-9a-f]{64}$/.test(value)) return false;
  const expected = createHmac("sha256", secret).update(`${userId}:${attemptId}`).digest();
  return timingSafeEqual(expected, Buffer.from(value, "hex"));
}
function forbidden() { return NextResponse.json({ error: "Invalid Paddle notification." }, { status: 400 }); }
function unavailable() { return NextResponse.json({ error: "Paddle verification unavailable." }, { status: 503 }); }

export async function POST(req: Request) {
  if (process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled" ||
      process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled" ||
      process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled") return unavailable();
  const secret = process.env.PADDLE_LIVE_WEBHOOK_SECRET;
  if (!secret || Number(req.headers.get("content-length") ?? 0) > 1024 * 1024) return unavailable();
  let raw: string;
  try { raw = await req.text(); } catch { return forbidden(); }
  if (!verifyPaddleWebhookSignature(raw, req.headers.get("paddle-signature"), secret)) return forbidden();
  let event: PaddleEvent;
  try { event = JSON.parse(raw); } catch { return forbidden(); }
  if (!event?.event_id || !/^evt_[a-z0-9]{26}$/.test(event.event_id) ||
      !event.event_type || !event.data?.id || !/^sub_[a-z0-9]{26}$/.test(event.data.id)) return forbidden();
  if (!allowed.has(event.event_type)) return NextResponse.json({ received: true, ignored: true });

  try {
    const eventId = event.event_id;
    const subscriptionId = event.data.id;
    const row = await prisma.billingSubscription.findUnique({
      where: { provider_providerSubscriptionId: { provider: "PADDLE", providerSubscriptionId: subscriptionId } },
    });
    if (row && !row.userId) return NextResponse.json({ received: true, ignored: "deleted_account" });
    const current = await paddleSubscription(subscriptionId);
    if (event.data.customer_id && current.customer_id !== event.data.customer_id) return forbidden();

    let userId = row?.userId ?? undefined;
    let attemptId: string | undefined;
    if (!userId) {
      // Only a completed Paddle transaction created for a specific locally
      // reserved checkout can associate a brand-new subscription with a user.
      if (event.event_type !== "subscription.created") return unavailable();
      const custom = event.data.custom_data;
      const transactionId = event.data.transaction_id;
      if (!custom?.userId || !custom.billingAttemptId || !transactionId ||
          !/^txn_[a-z0-9]{26}$/.test(transactionId) ||
          !compareBinding(custom.userId, custom.billingAttemptId, custom.binding)) return forbidden();
      const attempt = await prisma.billingCheckoutAttempt.findUnique({ where: { id: custom.billingAttemptId } });
      if (attempt?.userId !== custom.userId || attempt.provider !== "PADDLE" ||
          attempt.providerCheckoutId !== transactionId || attempt.status !== "OPEN") return forbidden();
      const response = await paddleApi<{ data?: Transaction }>(`transactions/${transactionId}`);
      const transaction = response.data;
      if (transaction?.id !== transactionId || transaction.subscription_id !== subscriptionId ||
          transaction.customer_id !== current.customer_id || transaction.status !== "completed" ||
          !transaction.items?.some(i => i.price?.id === process.env.PADDLE_LIVE_PRO_PRICE_ID && i.quantity === 1) ||
          transaction.custom_data?.userId !== custom.userId ||
          transaction.custom_data?.billingAttemptId !== custom.billingAttemptId ||
          !compareBinding(custom.userId, custom.billingAttemptId, transaction.custom_data?.binding))
        return unavailable();
      userId = custom.userId;
      attemptId = custom.billingAttemptId;
    } else if (event.data.custom_data?.userId && event.data.custom_data.userId !== userId) {
      return forbidden();
    }
    // Existing service implements advisory-lock ownership checks, idempotent event
    // receipts, payment evidence refresh, and projection of dated Pro entitlement.
    await webhook({ provider: "PADDLE", eventId, eventType: event.event_type,
      subscriptionId, customerId: current.customer_id, userId, attemptId, rawBody: raw,
      occurredAt: event.occurred_at ? new Date(event.occurred_at) : undefined });
    return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const digest = createHash("sha256").update(String(error instanceof Error ? error.name : "unexpected")).digest("hex");
    console.error("paddle_webhook_verification_failed", { eventType: event.event_type, code: digest.slice(0, 12) });
    return unavailable();
  }
}

import "server-only";
import { verifyPaddleLivePaidAccess } from "./paddle-live-evidence";
import type { VerifiedPaddleLivePayment } from "./paddle-live-evidence";

async function paddleLiveGet(path: string): Promise<unknown> {
 const key = process.env.PADDLE_LIVE_API_KEY;
 if (!key?.startsWith("pdl_live_apikey_"))
   throw Error("Live Paddle credentials missing.");
 const response = await fetch(`https://api.paddle.com${path}`, {
   headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
   cache: "no-store", signal: AbortSignal.timeout(12000),
 });
 if (!response.ok) throw Error("Paddle Live evidence unavailable.");
 return response.json();
}

/** Only the live server may verify Live Paddle subscriptions. */
export async function retrieveVerifiedPaddleLivePayment(
 subscriptionId: string,
): Promise<VerifiedPaddleLivePayment | null> {
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled" ||
     process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled" ||
     !/^sub_[a-z0-9]{26}$/.test(subscriptionId)) return null;
 const priceId = process.env.PADDLE_LIVE_PRO_PRICE_ID ?? "";
 const productId = process.env.PADDLE_LIVE_PRO_PRODUCT_ID ?? "";
 const bindingSecret = process.env.PADDLE_LIVE_BINDING_SECRET ?? "";
 if (!/^pri_[a-z0-9]{26}$/.test(priceId) ||
     !/^pro_[a-z0-9]{26}$/.test(productId) ||
     bindingSecret.length < 32) return null;
 const subscriptionResponse = await paddleLiveGet(`/subscriptions/${subscriptionId}`);
 const root = subscriptionResponse && typeof subscriptionResponse === "object" &&
   "data" in subscriptionResponse ? subscriptionResponse as { data: unknown } : null;
 if (!root) return null;
 const transactions: unknown[] = [];
 let cursor: string | null = null, complete = false;
 // Bound pagination prevents old customer histories from becoming unbounded work.
 for (let page = 0; page < 10; page++) {
   const path = `/transactions?subscription_id=${subscriptionId}&per_page=30` +
     (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
   const result = await paddleLiveGet(path);
   const envelope = result && typeof result === "object" ? result as Record<string, unknown> : null;
   if (!envelope || !Array.isArray(envelope.data)) return null;
   const pagination = envelope.meta && typeof envelope.meta === "object" &&
     "pagination" in envelope.meta ? (envelope.meta as { pagination: unknown }).pagination : null;
   if (!pagination || typeof pagination !== "object" ||
       !("has_more" in pagination) ||
       typeof (pagination as { has_more: unknown }).has_more !== "boolean") return null;
   const batch = envelope.data;
   transactions.push(...batch);
   if (!(pagination as { has_more: boolean }).has_more) { complete = true; break; }
   const last = batch.at(-1) as { id?: unknown } | undefined;
   if (typeof last?.id !== "string" || !/^txn_[a-z0-9]{26}$/.test(last.id) ||
       last.id === cursor) return null;
   cursor = last.id;
 }
 if (!complete) return null;
 const proof = verifyPaddleLivePaidAccess(root.data, transactions,
   { productId, priceId, bindingSecret });
 if (!proof) return null;

 // A completed charge remains completed after a refund. Cross-check provider
 // adjustments on the exact paid transaction before granting access.
 // Requires adjustment.read; failures deliberately deny new Live access.
 let adjustmentCursor: string | null = null, adjustmentsComplete = false;
 for (let page = 0; page < 10; page++) {
   const query = `/adjustments?transaction_id=${proof.paidTransactionId}&per_page=50` +
     (adjustmentCursor ? `&after=${encodeURIComponent(adjustmentCursor)}` : "");
   const response = await paddleLiveGet(query);
   const envelope = response && typeof response === "object" ?
     response as Record<string, unknown> : null;
   if (!envelope || !Array.isArray(envelope.data)) return null;
   for (const value of envelope.data) {
     const adjustment = value && typeof value === "object" ?
       value as Record<string, unknown> : null;
     if (!adjustment || adjustment.transaction_id !== proof.paidTransactionId) return null;
     if (["refund", "chargeback", "chargeback_warning"].includes(String(adjustment.action)) &&
         ["approved", "pending_approval"].includes(String(adjustment.status))) return null;
   }
   const pagination = envelope.meta && typeof envelope.meta === "object" &&
     "pagination" in envelope.meta ? (envelope.meta as { pagination: unknown }).pagination : null;
   if (!pagination || typeof pagination !== "object" ||
       typeof (pagination as { has_more?: unknown }).has_more !== "boolean") return null;
   if (!(pagination as { has_more: boolean }).has_more) {
     adjustmentsComplete = true;
     break;
   }
   const last = envelope.data.at(-1) as { id?: unknown } | undefined;
   if (typeof last?.id !== "string" || !/^adj_[a-z0-9]{26}$/.test(last.id) ||
       last.id === adjustmentCursor) return null;
   adjustmentCursor = last.id;
 }
 return adjustmentsComplete ? proof : null;
}

/**
 * Only provider-confirmed termination states may change the Live ledger.
 * Webhook payloads are hints, not trusted subscription status.
 */
export async function retrievePaddleLiveSubscriptionState(subscriptionId: string):
  Promise<{ subscriptionId: string; customerId: string; status: string } | null> {
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled" ||
     !/^sub_[a-z0-9]{26}$/.test(subscriptionId)) return null;
 const data = await paddleLiveGet(`/subscriptions/${subscriptionId}`);
 const sub = data && typeof data === "object" && "data" in data
   ? (data as { data: unknown }).data : null;
 if (!sub || typeof sub !== "object") return null;
 const v = sub as Record<string, unknown>;
 if (v.id !== subscriptionId ||
     typeof v.customer_id !== "string" ||
     !/^ctm_[a-z0-9]{26}$/.test(v.customer_id) ||
     typeof v.status !== "string") return null;
 return { subscriptionId, customerId: v.customer_id, status: v.status };
}

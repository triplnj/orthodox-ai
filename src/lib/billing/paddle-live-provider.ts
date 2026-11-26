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
 return verifyPaddleLivePaidAccess(root.data, transactions,
   { productId, priceId, bindingSecret });
}

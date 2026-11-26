import { verifyPaddleLiveBinding } from "./paddle-live-binding";

type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict | null =>
 v !== null && typeof v === "object" && !Array.isArray(v) ? v as Dict : null;
const isoDate = (v: unknown): Date | null => {
 if (typeof v !== "string") return null;
 const parsed = new Date(v);
 return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const validId = (kind: string, v: unknown) =>
 typeof v === "string" && new RegExp(`^${kind}_[a-z0-9]{26}$`).test(v);

export type VerifiedPaddleLivePayment = {
 userId: string; subscriptionId: string; customerId: string;
 productId: string; priceId: string; paidTransactionId: string;
 periodEndsAt: Date; cancelAtPeriodEnd: boolean;
};

/**
 * Pure payment evidence check: a signed original checkout binding proves
 * ownership and a different completed transaction may pay a later cycle.
 * Never grant access from event payloads or client-provided checkout data.
 */
export function verifyPaddleLivePaidAccess(
 subscriptionValue: unknown, transactionValues: unknown[], config: {
   productId: string; priceId: string; bindingSecret: string;
 }, now = new Date(),
): VerifiedPaddleLivePayment | null {
 const sub = obj(subscriptionValue);
 if (!sub || !Array.isArray(transactionValues) ||
     !validId("sub", sub.id) || !validId("ctm", sub.customer_id) ||
     sub.status !== "active" || !Number.isFinite(now.getTime())) return null;
 const period = obj(sub.current_billing_period);
 const start = isoDate(period?.starts_at), end = isoDate(period?.ends_at);
 if (!start || !end || start > now || end <= now ||
     end.getTime() - now.getTime() > 400 * 86400_000) return null;
 const cycle = obj(sub.billing_cycle);
 if (cycle?.interval !== "month" || cycle.frequency !== 1 ||
     !Array.isArray(sub.items) || sub.items.length !== 1) return null;
 const item = obj(sub.items[0]), price = obj(item?.price);
 if (!item || item.status !== "active" || item.quantity !== 1 || !price ||
     !validId("pro", config.productId) || !validId("pri", config.priceId) ||
     price.id !== config.priceId || price.product_id !== config.productId) return null;
 const subData = obj(sub.custom_data);
 const fields = [
   "orthodoxai_binding_version", "orthodoxai_user_id",
   "orthodoxai_issued_at", "orthodoxai_nonce", "orthodoxai_signature",
 ] as const;
 if (!subData) return null;
 let userId: string | null = null;
 let current: { id: string; time: Date } | null = null;
 for (const value of transactionValues) {
   const tx = obj(value);
   if (!tx || !validId("txn", tx.id) || tx.status !== "completed" ||
       tx.subscription_id !== sub.id || tx.customer_id !== sub.customer_id ||
       tx.collection_mode !== "automatic" || tx.currency_code !== "USD") continue;
   const total = obj(obj(tx.details)?.totals)?.total;
   if (typeof total !== "string" || !/^\d+$/.test(total) || Number(total) <= 0) continue;
   const time = isoDate(tx.created_at);
   if (!time || time > now) continue;
   const txData = obj(tx.custom_data);
   if (!txData || !fields.every(field => txData[field] === subData[field])) continue;
   const signedOwner = verifyPaddleLiveBinding(txData, config.bindingSecret,
     Math.floor(time.getTime() / 1000));
   if (signedOwner) {
     if (userId && signedOwner.userId !== userId) return null;
     userId = signedOwner.userId;
   }
   if (time.getTime() >= start.getTime() - 3600_000 && time < end &&
       (!current || time > current.time)) current = { id: tx.id as string, time };
 }
 if (!userId || !current) return null;
 const scheduled = obj(sub.scheduled_change);
 return {
   userId,
   subscriptionId: sub.id as string,
   customerId: sub.customer_id as string,
   productId: config.productId,
   priceId: config.priceId,
   paidTransactionId: current.id,
   periodEndsAt: end,
   cancelAtPeriodEnd: scheduled?.action === "cancel",
 };
}

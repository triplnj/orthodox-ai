import { PADDLE_SANDBOX_CATALOG } from "./paddle-sandbox-catalog";
import { verifyPaddleCheckoutBinding } from "./paddle-checkout-binding";

type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Dict : null;
const str = (v: unknown): string => typeof v === "string" ? v : "";
const timestamp = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const date = new Date(v);
  return Number.isFinite(date.getTime()) ? date : null;
};
const paddleId = (prefix: string, value: unknown): value is string =>
  typeof value === "string" && new RegExp(`^${prefix}_[a-z0-9]{26}$`).test(value);

export type VerifiedPaddleSandboxAccess = {
  userId: string; subscriptionId: string; customerId: string;
  paidTransactionId: string; periodEndsAt: Date;
};

/**
 * Evidence extraction ONLY. Never call on an unverified webhook or on simulated
 * notification payloads. The caller must retrieve subscription + transactions
 * directly from Paddle Sandbox API using a server-side API key.
 */
export function verifyPaddleSandboxPaidAccess(
  subscriptionResponse: unknown, transactionsResponse: unknown, bindingSecret: string,
  now = new Date(),
): VerifiedPaddleSandboxAccess | null {
  const sub = obj(subscriptionResponse);
  const txns = Array.isArray(transactionsResponse) ? transactionsResponse : null;
  if (!sub || !txns || !paddleId("sub", sub.id) || sub.status !== "active" ||
      !paddleId("ctm", sub.customer_id) || !Number.isFinite(now.getTime())) return null;

  const period = obj(sub.current_billing_period);
  const endsAt = timestamp(period?.ends_at);
  const startsAt = timestamp(period?.starts_at);
  if (!endsAt || !startsAt || startsAt > now || endsAt <= now ||
      endsAt.getTime() - now.getTime() > 400 * 24 * 3600_000) return null;

  const cycle = obj(sub.billing_cycle);
  if (cycle?.interval !== "month" || cycle.frequency !== 1 ||
      !Array.isArray(sub.items) || sub.items.length !== 1) return null;
  const item = obj(sub.items[0]);
  const price = obj(item?.price);
  if (!item || item.quantity !== 1 || item.status !== "active" || !price ||
      price.id !== PADDLE_SANDBOX_CATALOG.monthlyPriceId ||
      price.product_id !== PADDLE_SANDBOX_CATALOG.productId) return null;

  // Do not interpret 'active' from simulator or browser as paid evidence.
  // The direct Paddle API must supply a completed, nonzero payment transaction.
  for (const value of txns) {
    const tx = obj(value);
    if (!tx || !paddleId("txn", tx.id) || tx.status !== "completed" ||
        tx.subscription_id !== sub.id || tx.customer_id !== sub.customer_id ||
        tx.currency_code !== "USD" || tx.collection_mode !== "automatic") continue;
    const totals = obj(obj(tx.details)?.totals);
    const paid = str(totals?.total);
    if (!/^\d+$/.test(paid) || Number(paid) <= 0) continue;

    const issuedAt = timestamp(tx.created_at);
    if (!issuedAt || issuedAt > now) continue;
    const signedData = obj(tx.custom_data);
    const signed = verifyPaddleCheckoutBinding(signedData, bindingSecret,
      Math.floor(issuedAt.getTime() / 1000));
    if (!signedData || !signed) continue;
    // Verify that subscription and originating completed transaction agree on
    // immutable ownership metadata. They must not be forged independently.
    const subData = obj(sub.custom_data);
    // Paddle may serialize object keys in a different order.
    const bindingFields = [
      "orthodoxai_binding_version", "orthodoxai_user_id",
      "orthodoxai_issued_at", "orthodoxai_nonce", "orthodoxai_signature",
    ] as const;
    if (!subData || !bindingFields.every(key => subData[key] === signedData[key])) continue;
    return {
      userId: signed.userId,
      subscriptionId: sub.id,
      customerId: sub.customer_id,
      paidTransactionId: tx.id,
      periodEndsAt: endsAt,
    };
  }
  return null;
}

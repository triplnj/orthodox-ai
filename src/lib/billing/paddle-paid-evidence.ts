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

  // The checkout's signed owner binding is immutable identity evidence, not
  // a new authorization token for each renewal. Paddle propagates custom_data
  // to subsequent subscription transactions. Re-verify that the completed
  // initial transaction originally carried that binding, then independently
  // require a completed positive payment in the CURRENT billing period.
  const subData = obj(sub.custom_data);
  const bindingFields = [
    "orthodoxai_binding_version", "orthodoxai_user_id",
    "orthodoxai_issued_at", "orthodoxai_nonce", "orthodoxai_signature",
  ] as const;
  if (!subData) return null;

  const validTransaction = (value: unknown) => {
    const tx = obj(value);
    if (!tx || !paddleId("txn", tx.id) || tx.status !== "completed" ||
        tx.subscription_id !== sub.id || tx.customer_id !== sub.customer_id ||
        tx.currency_code !== "USD" || tx.collection_mode !== "automatic") return null;
    const totals = obj(obj(tx.details)?.totals);
    const paid = str(totals?.total);
    if (!/^\\d+$/.test(paid) || Number(paid) <= 0) return null;
    const issuedAt = timestamp(tx.created_at);
    if (!issuedAt || issuedAt > now) return null;
    const data = obj(tx.custom_data);
    if (!data || !bindingFields.every(key => data[key] === subData[key])) return null;
    return { tx, issuedAt, data };
  };

  let owner: { userId: string } | null = null;
  for (const candidate of txns) {
    const verified = validTransaction(candidate);
    if (!verified) continue;
    const signed = verifyPaddleCheckoutBinding(verified.data, bindingSecret,
      Math.floor(verified.issuedAt.getTime() / 1000));
    if (signed) {
      owner = signed;
      break;
    }
  }
  if (!owner) return null;

  for (const candidate of txns) {
    const verified = validTransaction(candidate);
    if (!verified) continue;
    // A payment from an earlier period cannot authorize an unpaid renewal.
    // Allow at most one hour of advance processing for the new billing cycle.
    if (verified.issuedAt.getTime() < startsAt.getTime() - 60 * 60_000 ||
        verified.issuedAt >= endsAt) continue;
    return {
      userId: owner.userId,
      subscriptionId: sub.id,
      customerId: sub.customer_id,
      paidTransactionId: verified.tx.id as string,
      periodEndsAt: endsAt,
    };
  }
  return null;
}

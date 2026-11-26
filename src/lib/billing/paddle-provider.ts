import "server-only";
import { BillingError, type Subscription } from "./providers";

const idPattern = { sub: /^sub_[a-z0-9]{26}$/, ctm: /^ctm_[a-z0-9]{26}$/ };
const safeDate = (s: unknown): Date | null => {
  if (typeof s !== "string") return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
};
function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new BillingError("Paddle Live configuration is incomplete.", 503);
  return value;
}
export async function paddleApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const credential = required("PADDLE_LIVE_API_KEY");
  if (!credential.startsWith("pdl_live_")) throw new BillingError("Paddle credential is not Live.", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.paddle.com/${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${credential}`, Accept: "application/json", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new BillingError("Paddle is unavailable; billing access remains protected.", 503); }
  if (!response.ok) throw new BillingError("Paddle verification failed; billing access remains protected.", 503);
  try { return await response.json() as T; }
  catch { throw new BillingError("Invalid Paddle response.", 503); }
}
type PaddleSubscription = {
  id: string; customer_id: string; status: string; updated_at: string;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  items?: Array<{ price?: { id?: string; product_id?: string }; quantity?: number }>;
};
type PaddleTransaction = { id: string; subscription_id?: string | null; customer_id?: string | null;
  status?: string; items?: Array<{ price?: { id?: string }; quantity?: number }>;
  details?: { totals?: { grand_total?: string; currency_code?: string } };
};
type Page<T> = { data?: T[]; meta?: { pagination?: { has_more?: boolean; next?: string | null } } };
type PaddleAdjustment = { transaction_id: string; subscription_id?: string; action: string; type: string; status: string };
function validateSubscription(s: PaddleSubscription): void {
  if (!idPattern.sub.test(s.id) || !idPattern.ctm.test(s.customer_id) ||
      !s.items?.some(i => i.price?.id === required("PADDLE_LIVE_PRO_PRICE_ID") &&
        i.price?.product_id === required("PADDLE_LIVE_PRO_PRODUCT_ID") && i.quantity === 1)) {
    throw new BillingError("Paddle subscription product, owner, or identity mismatch.");
  }
}
export async function paddleSubscription(id: string): Promise<PaddleSubscription> {
  if (!idPattern.sub.test(id)) throw new BillingError("Invalid Paddle subscription identity.", 400);
  const result = await paddleApi<{data?: PaddleSubscription}>(`subscriptions/${id}`);
  if (!result.data || result.data.id !== id) throw new BillingError("Paddle subscription mismatch.", 503);
  validateSubscription(result.data);
  return result.data;
}
export async function paddleRetrieve(id: string): Promise<Subscription> {
  const s = await paddleSubscription(id);
  const period = safeDate(s.current_billing_period?.ends_at);
  const update = safeDate(s.updated_at);
  if (!update || (s.status === "active" && !period)) throw new BillingError("Paddle period evidence is incomplete.", 503);
  let paidVerified = false;
  if (s.status === "active") {
    const reversed = new Set<string>();
    let adjustmentCursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ subscription_id: id, per_page: "50" });
      if (adjustmentCursor) q.set("after", adjustmentCursor);
      const adjustments = await paddleApi<Page<PaddleAdjustment>>(`adjustments?${q.toString()}`);
      if (!Array.isArray(adjustments.data) || !adjustments.meta?.pagination) throw new BillingError("Paddle refund inventory is unavailable.", 503);
      for (const adjustment of adjustments.data) {
        if (adjustment.subscription_id && adjustment.subscription_id !== id) throw new BillingError("Paddle refund association mismatch.");
        if (adjustment.status === "approved" && adjustment.type === "full" &&
            ["refund", "chargeback"].includes(adjustment.action)) reversed.add(adjustment.transaction_id);
      }
      if (!adjustments.meta.pagination.has_more) break;
      const next = adjustments.meta.pagination.next;
      if (!next) throw new BillingError("Paddle refund pagination unavailable.", 503);
      const url = new URL(next);
      if (url.origin !== "https://api.paddle.com" || url.pathname !== "/adjustments") throw new BillingError("Paddle refund pagination endpoint invalid.", 503);
      adjustmentCursor = url.searchParams.get("after");
      if (!adjustmentCursor || !/^adj_[a-z0-9]{26}$/.test(adjustmentCursor)) throw new BillingError("Paddle refund pagination cursor invalid.", 503);
      if (page === 9) throw new BillingError("Paddle refund inventory exceeds safe bounds.", 503);
    }
    // Read a bounded, provider-authenticated transaction inventory and require
    // a completed, positive charge for the exact Pro price and customer.
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ subscription_id: id, per_page: "30" });
      if (cursor) q.set("after", cursor);
      const result = await paddleApi<Page<PaddleTransaction>>(`transactions?${q.toString()}`);
      if (!Array.isArray(result.data) || !result.meta?.pagination) throw new BillingError("Paddle paid inventory unavailable.", 503);
      for (const t of result.data) {
        if (t.subscription_id !== id || t.customer_id !== s.customer_id) throw new BillingError("Paddle transaction ownership mismatch.");
        if (!reversed.has(t.id) && t.status === "completed" &&
            t.items?.some(i => i.price?.id === required("PADDLE_LIVE_PRO_PRICE_ID") && i.quantity === 1) &&
            Number(t.details?.totals?.grand_total ?? 0) > 0 &&
            t.details?.totals?.currency_code === "USD") paidVerified = true;
      }
      if (!result.meta.pagination.has_more) break;
      const next = result.meta.pagination.next;
      if (!next) throw new BillingError("Paddle inventory pagination invalid.", 503);
      const nextUrl = new URL(next);
      if (nextUrl.origin !== "https://api.paddle.com" || nextUrl.pathname !== "/transactions") throw new BillingError("Paddle inventory next page is invalid.", 503);
      cursor = nextUrl.searchParams.get("after");
      if (!cursor || !/^txn_[a-z0-9]{26}$/.test(cursor)) throw new BillingError("Paddle inventory cursor invalid.", 503);
      if (page === 9) throw new BillingError("Paddle transaction inventory exceeds verification bounds.", 503);
    }
  }
  return { provider: "PADDLE", providerSubscriptionId: s.id,
    providerCustomerId: s.customer_id, providerProductId: required("PADDLE_LIVE_PRO_PRODUCT_ID"),
    status: s.status, trialEndsAt: null, currentPeriodEndsAt: period,
    cancelAtPeriodEnd: s.scheduled_change?.action === "cancel",
    providerUpdatedAt: update, paidVerified };
}
export async function paddleInventory(customerId: string): Promise<Subscription[]> {
  if (!idPattern.ctm.test(customerId)) throw new BillingError("Invalid Paddle customer.", 400);
  const subscriptions: Subscription[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ customer_id: customerId, per_page: "100" });
    if (cursor) q.set("after", cursor);
    const result = await paddleApi<Page<PaddleSubscription>>(`subscriptions?${q.toString()}`);
    if (!Array.isArray(result.data) || !result.meta?.pagination) throw new BillingError("Paddle inventory unavailable.", 503);
    for (const s of result.data) {
      if (s.customer_id !== customerId) throw new BillingError("Paddle customer mismatch.");
      // Include every subscription, including unexpected products: never silently
      // hide an unresolved charge when deleting accounts.
      validateSubscription(s);
      subscriptions.push(await paddleRetrieve(s.id));
    }
    if (!result.meta.pagination.has_more) return subscriptions;
    const next = result.meta.pagination.next;
    if (!next) throw new BillingError("Paddle inventory cursor invalid.", 503);
    const nextUrl = new URL(next);
    if (nextUrl.origin !== "https://api.paddle.com" || nextUrl.pathname !== "/subscriptions") throw new BillingError("Paddle pagination endpoint mismatch.", 503);
    cursor = nextUrl.searchParams.get("after");
    if (!cursor || !/^sub_[a-z0-9]{26}$/.test(cursor)) throw new BillingError("Paddle inventory cursor invalid.", 503);
  }
  throw new BillingError("Paddle inventory exceeds verification bounds.", 503);
}
export async function paddlePortal(customerId: string, subscriptionId: string): Promise<string> {
  const s = await paddleSubscription(subscriptionId);
  if (s.customer_id !== customerId) throw new BillingError("Paddle portal customer mismatch.");
  const response = await paddleApi<{data?:{urls?:{general?:{overview?:string}}}}>(
    `customers/${encodeURIComponent(customerId)}/portal-sessions`, "POST",
    { subscription_ids: [subscriptionId] });
  const url = response.data?.urls?.general?.overview;
  if (!url || !url.startsWith("https://") || !new URL(url).hostname.endsWith(".paddle.com"))
    throw new BillingError("Paddle portal returned an invalid destination.", 503);
  return url;
}
export async function paddleCancel(s: Subscription): Promise<void> {
  if (["canceled", "cancelled"].includes(s.status)) return;
  await paddleApi(`subscriptions/${encodeURIComponent(s.providerSubscriptionId)}/cancel`, "POST",
    { effective_from: "next_billing_period" });
}
export async function paddleHasUnresolvedDebt(customerId: string): Promise<void> {
  // Never claim account deletion is safe based on subscription status alone.
  // Manual review is required until complete payment/adjustment inventory support exists.
  void customerId;
  throw new BillingError("Paddle billing requires manual final liability review before account deletion.", 409);
}

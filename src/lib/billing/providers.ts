import "server-only";
import { getStripe } from "@/lib/stripe";

export type Provider = "STRIPE" | "LEMONSQUEEZY";
export class BillingError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
export type Subscription = {
  provider: Provider; providerSubscriptionId: string; providerCustomerId: string;
  providerProductId: string; status: string; trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null; cancelAtPeriodEnd: boolean;
  providerUpdatedAt: Date | null; paidVerified: boolean; portalUrl?: string;
};
type LemonData = { id: string; type: string; attributes: {
  customer_id?: number; variant_id?: number; store_id?: number; status?: string;
  trial_ends_at?: string; renews_at?: string; ends_at?: string; updated_at?: string;
  cancelled?: boolean; test_mode?: boolean; urls?: { customer_portal?: string };
  url?: string; expires_at?: string;
} };
type LemonResponse = { data: LemonData; meta?: { page?: { currentPage: number; lastPage: number } } };
function date(value: string | number | null | undefined): Date | null {
  if (!value) return null;
  const result = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isFinite(result.getTime()) ? result : null;
}
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new BillingError("Billing provider configuration is unavailable.", 503);
  return value;
}
async function providerRequest<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof BillingError) throw error;
    throw new BillingError("Billing provider is temporarily unavailable.", 503);
  }
}
export async function lemon(path: string, method = "GET", body?: unknown): Promise<LemonResponse> {
  // Paths are constructed locally; never follow provider-supplied pagination URLs.
  const response = await providerRequest(() => fetch(`https://api.lemonsqueezy.com/v1/${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${required("LEMONSQUEEZY_API_KEY")}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  if (!response.ok) throw new BillingError("Billing provider request failed; billing state remains protected.", 503);
  return providerRequest(() => response.json());
}
function fromLemon(data: LemonData): Subscription {
  const a = data.attributes;
  if (String(a.store_id) !== required("LEMONSQUEEZY_STORE_ID") ||
      String(a.variant_id) !== required("LEMONSQUEEZY_PRO_VARIANT_ID") ||
      (process.env.NODE_ENV === "production" && a.test_mode !== false)) {
    throw new BillingError("Subscription product or environment does not match.");
  }
  return { provider: "LEMONSQUEEZY", providerSubscriptionId: String(data.id),
    providerCustomerId: String(a.customer_id), providerProductId: String(a.variant_id),
    status: a.status ?? "unknown", trialEndsAt: date(a.trial_ends_at),
    currentPeriodEndsAt: date(a.ends_at ?? a.renews_at), cancelAtPeriodEnd: Boolean(a.cancelled),
    providerUpdatedAt: date(a.updated_at), paidVerified: a.status === "active",
    portalUrl: a.urls?.customer_portal };
}
export async function retrieve(provider: Provider, id: string): Promise<Subscription> {
  if (provider === "LEMONSQUEEZY") {
    const subscription = fromLemon((await lemon(`subscriptions/${encodeURIComponent(id)}`)).data);
    subscription.paidVerified = false;
    if (subscription.status === "active") {
      const invoices = await lemon(`subscription-invoices?filter[subscription_id]=${encodeURIComponent(id)}&page[size]=100`);
      const rows = invoices.data as unknown as Array<{ attributes: { subscription_id?: number; status?: string; total?: number } }>;
      if (!Array.isArray(rows)) throw new BillingError("Paid subscription evidence is unavailable.", 503);
      subscription.paidVerified = rows.some(row => String(row.attributes.subscription_id) === id && row.attributes.status === "paid" && Number(row.attributes.total) > 0);
    }
    return subscription;
  }
  const s = await providerRequest(() => getStripe().subscriptions.retrieve(id, {}, { timeout: 10000, maxNetworkRetries: 0 }));
  const price = required("STRIPE_PRO_PRICE_ID");
  if (!s.items.data.some(item => item.price.id === price) ||
      (process.env.NODE_ENV === "production" && !s.livemode)) throw new BillingError("Subscription product or environment does not match.");
  const item = s.items.data.find(item => item.price.id === price)!;
  const invoice = s.status === "active" && s.latest_invoice
    ? (typeof s.latest_invoice === "string"
      ? await providerRequest(() => getStripe().invoices.retrieve(s.latest_invoice as string, {}, { timeout: 10000, maxNetworkRetries: 0 }))
      : s.latest_invoice) : null;
  return { provider, providerSubscriptionId: s.id,
    providerCustomerId: typeof s.customer === "string" ? s.customer : s.customer.id,
    providerProductId: price, status: s.status, trialEndsAt: date(s.trial_end),
    currentPeriodEndsAt: date(item.current_period_end), cancelAtPeriodEnd: s.cancel_at_period_end,
    providerUpdatedAt: null, paidVerified: Boolean(invoice?.status === "paid" && invoice.amount_paid > 0) };
}
export async function inventory(provider: Provider, customerId: string): Promise<Subscription[]> {
  const ids: string[] = [];
  if (provider === "STRIPE") {
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const result = await providerRequest(() => getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 100,
        ...(cursor ? { starting_after: cursor } : {}) }, { timeout: 10000, maxNetworkRetries: 0 }));
      ids.push(...result.data.map(s => s.id));
      if (!result.has_more) return Promise.all(ids.map(id => retrieve(provider, id)));
      cursor = result.data.at(-1)?.id;
      if (!cursor) break;
    }
  } else {
    for (let page = 1; page <= 100; page++) {
      const result = await lemon(`subscriptions?filter[customer_id]=${encodeURIComponent(customerId)}&page[number]=${page}&page[size]=100`);
      const rows = result.data as unknown as LemonData[];
      if (!Array.isArray(rows)) throw new BillingError("Invalid provider inventory.", 503);
      ids.push(...rows.map(s => String(s.id)));
      const pagination = result.meta?.page;
      if (!pagination) throw new BillingError("Provider pagination could not be verified.", 503);
      if (pagination.currentPage >= pagination.lastPage) return Promise.all(ids.map(id => retrieve(provider, id)));
    }
  }
  throw new BillingError("Subscription inventory exceeded safe pagination bounds.", 503);
}
export function terminal(s: Subscription): boolean {
  return s.provider === "STRIPE" ? ["canceled", "incomplete_expired"].includes(s.status)
    : ["cancelled", "expired"].includes(s.status);
}
export async function cancel(s: Subscription) {
  if (terminal(s)) return;
  if (s.provider === "STRIPE") await getStripe().subscriptions.cancel(s.providerSubscriptionId, {}, { timeout: 10000, maxNetworkRetries: 0 });
  else await lemon(`subscriptions/${encodeURIComponent(s.providerSubscriptionId)}`, "DELETE");
}
export async function assertNoDebt(provider: Provider, customerId: string) {
  if (provider === "STRIPE") {
    for (const status of ["open", "draft"] as const) {
      const invoices = await getStripe().invoices.list({ customer: customerId, status, limit: 1 }, { timeout: 10000, maxNetworkRetries: 0 });
      if (invoices.data.length) throw new BillingError("Outstanding invoices require billing support before deletion.");
    }
  } else {
    // Subscription cancellation does not prove that payment retries have stopped.
    for (const subscription of await inventory(provider, customerId)) {
    for (let page = 1; page <= 100; page++) {
      const result = await lemon(`subscription-invoices?filter[subscription_id]=${encodeURIComponent(subscription.providerSubscriptionId)}&page[number]=${page}&page[size]=100`);
      const rows = result.data as unknown as Array<{ attributes: { subscription_id?: number; status?: string } }>;
      if (!Array.isArray(rows) || rows.some(row => String(row.attributes.subscription_id) !== subscription.providerSubscriptionId ||
          !["paid", "refunded", "void"].includes(row.attributes.status ?? ""))) {
        throw new BillingError("Outstanding or uncertain invoices require billing support before deletion.");
      }
      const pagination = result.meta?.page;
      if (!pagination) throw new BillingError("Invoice inventory could not be verified.", 503);
      if (pagination.currentPage >= pagination.lastPage) break;
      if (page === 100) throw new BillingError("Invoice inventory exceeded safe pagination bounds.", 503);
    }
    }
  }
}
export async function createCheckout(provider: Provider, user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }, attemptId: string) {
  const appUrl = required("NEXT_PUBLIC_APP_URL");
  if (provider === "STRIPE") {
    const price = required("STRIPE_PRO_PRICE_ID");
    const stripe = getStripe();
    const customerId = user.stripeCustomerId ?? (await stripe.customers.create({ email: user.email,
      name: user.name ?? undefined, metadata: { userId: user.id } }, { idempotencyKey: `customer:${user.id}`, timeout: 10000, maxNetworkRetries: 0 })).id;
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId,
      line_items: [{ price, quantity: 1 }], success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`, metadata: { userId: user.id, billingAttemptId: attemptId },
      subscription_data: { metadata: { userId: user.id, billingAttemptId: attemptId } } },
    { idempotencyKey: attemptId, timeout: 10000, maxNetworkRetries: 0 });
    if (!session.url) throw new BillingError("Checkout outcome is uncertain.", 503);
    return { id: session.id, url: session.url, expiresAt: date(session.expires_at), customerId };
  }
  const result = await lemon("checkouts", "POST", { data: { type: "checkouts", relationships: {
    store: { data: { type: "stores", id: required("LEMONSQUEEZY_STORE_ID") } },
    variant: { data: { type: "variants", id: required("LEMONSQUEEZY_PRO_VARIANT_ID") } } }, attributes: {
      checkout_data: { email: user.email, name: user.name ?? undefined, custom: { userId: user.id, billingAttemptId: attemptId } },
      product_options: { redirect_url: `${appUrl}/pro/success` },
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() } } });
  if (!result.data?.id || !result.data.attributes.url) throw new BillingError("Checkout outcome is uncertain.", 503);
  return { id: String(result.data.id), url: result.data.attributes.url, expiresAt: date(result.data.attributes.expires_at), customerId: null };
}
export async function checkoutClosed(provider: Provider, id: string): Promise<boolean> {
  if (provider === "STRIPE") {
    const session = await getStripe().checkout.sessions.retrieve(id, {}, { timeout: 10000, maxNetworkRetries: 0 });
    return session.status === "expired" || session.status === "complete";
  }
  // No assumption that a local timeout invalidates a hosted Lemon checkout.
  const checkout = (await lemon(`checkouts/${encodeURIComponent(id)}`)).data;
  const expires = date(checkout.attributes.expires_at);
  return Boolean(expires && expires.getTime() <= Date.now());
}
export async function portal(provider: Provider, customerId: string, subscriptionId?: string): Promise<string> {
  if (provider === "STRIPE") return (await getStripe().billingPortal.sessions.create({ customer: customerId,
    return_url: `${required("NEXT_PUBLIC_APP_URL")}/pro` }, { timeout: 10000, maxNetworkRetries: 0 })).url;
  if (!subscriptionId) throw new BillingError("Subscription reference missing.");
  const url = (await retrieve(provider, subscriptionId)).portalUrl;
  if (!url) throw new BillingError("Billing portal is unavailable.", 503);
  return url;
}

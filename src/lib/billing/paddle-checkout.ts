import "server-only";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHmac } from "node:crypto";

const PENDING = ["CREATING", "OPEN", "UNKNOWN", "PAID_OPEN"];
const TRANSACTION = /^txn_[a-z0-9]{26}$/;
const PRICE = /^pri_[a-z0-9]{26}$/;

class CheckoutError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new CheckoutError("Paddle Live checkout configuration is incomplete.", 503);
  return value;
};

function liveReady() {
  if (process.env.PADDLE_LIVE_CHECKOUT_ENABLED !== "enabled" ||
      process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled" ||
      process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled" ||
      process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
      process.env.NEXT_PUBLIC_PADDLE_LIVE_CHECKOUT_ENABLED !== "enabled") {
    throw new CheckoutError("Paddle Live checkout is not available yet.", 503);
  }
}

async function paddleApi(path: string, options?: { method: string; body: unknown }) {
  let response: Response;
  try {
    response = await fetch(`https://api.paddle.com/${path}`, {
      method: options?.method ?? "GET",
      headers: { Authorization: `Bearer ${required("PADDLE_LIVE_API_KEY")}`,
        "Content-Type": "application/json", Accept: "application/json" },
      ...(options ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new CheckoutError("Paddle could not be reached; no second checkout will be started until this attempt is reconciled.", 503);
  }
  if (!response.ok) throw new CheckoutError("Paddle could not confirm the checkout request.", 503);
  try { return await response.json() as { data?: Record<string, unknown> }; }
  catch { throw new CheckoutError("Paddle returned an invalid response.", 503); }
}

async function assertPrice(priceId: string, productId: string) {
  const { data } = await paddleApi(`prices/${encodeURIComponent(priceId)}`);
  const price = data as { id?: string; product_id?: string; status?: string;
    billing_cycle?: { interval?: string; frequency?: number } | null;
    unit_price?: { amount?: string; currency_code?: string } } | undefined;
  if (price?.id !== priceId || price.product_id !== productId || price.status !== "active" ||
      price.billing_cycle?.interval !== "month" || price.billing_cycle?.frequency !== 1 ||
      price.unit_price?.amount !== "799" || price.unit_price?.currency_code !== "USD") {
    throw new CheckoutError("Configured Paddle price is not the approved $7.99 monthly Pro plan.", 503);
  }
}

async function withUserLock<T>(userId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>): Promise<T> {
  // Serializable checkout reservation is scoped to the same advisory lock used by legacy billing.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing:${userId}`}, 0))`;
    return fn(tx);
  }, { timeout: 30000, maxWait: 10000 });
}

export async function createPaddleLiveCheckout(userId: string) {
  liveReady();
  const key = required("PADDLE_LIVE_API_KEY");
  if (!key.startsWith("pdl_live_")) throw new CheckoutError("Paddle Live API credential does not match the live environment.", 503);
  const token = required("NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN");
  if (!token.startsWith("live_")) throw new CheckoutError("Paddle Live client token is invalid.", 503);
  const priceId = required("PADDLE_LIVE_PRO_PRICE_ID");
  const productId = required("PADDLE_LIVE_PRO_PRODUCT_ID");
  if (!PRICE.test(priceId) || !/^pro_[a-z0-9]{26}$/.test(productId)) throw new CheckoutError("Paddle product configuration is invalid.", 503);
  required("PADDLE_LIVE_WEBHOOK_SECRET");
  required("PADDLE_LIVE_BINDING_SECRET");
  await assertPrice(priceId, productId);

  const reservation = await withUserLock(userId, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new CheckoutError("Sign in before upgrading.", 401);
    if (!user.emailVerified) throw new CheckoutError("Verify your email before upgrading.", 403);
    if (user.billingDeletionRequestedAt) throw new CheckoutError("Account deletion is pending.", 409);
    const reviewEmails = [process.env.REVIEW_USER_EMAIL, process.env.REVIEW_CLERGY_USER_EMAIL].filter(Boolean);
    if (reviewEmails.some(email => email?.toLowerCase() === user.email.toLowerCase())) throw new CheckoutError("Billing is disabled for review accounts.", 403);
    const prior = await tx.billingCheckoutAttempt.findFirst({
      where: { userId, status: { in: PENDING } }, orderBy: { createdAt: "desc" },
    });
    if (prior) {
      if (prior.provider === "PADDLE" && prior.status === "OPEN" &&
          prior.providerCheckoutId && TRANSACTION.test(prior.providerCheckoutId) &&
          prior.expiresAt && prior.expiresAt > new Date()) {
        return { transactionId: prior.providerCheckoutId, clientToken: token };
      }
      throw new CheckoutError("A previous checkout is unresolved. Billing support must reconcile it before a new purchase.");
    }
    const existing = await tx.billingSubscription.findFirst({
      where: { userId, status: { in: ["active", "trialing", "past_due", "paused"] } },
    });
    if (existing || user.subscriptionId || user.lemonSqueezySubscriptionId || user.plan === "PRO") {
      throw new CheckoutError("An existing subscription or Pro entitlement requires review before another purchase.");
    }
    const attempt = await tx.billingCheckoutAttempt.create({
      data: { userId, provider: "PADDLE", status: "CREATING" },
    });
    return { attemptId: attempt.id, email: user.email };
  });
  if ("transactionId" in reservation) return reservation;

  try {
    const binding = createHmac("sha256", required("PADDLE_LIVE_BINDING_SECRET"))
      .update(`${userId}:${reservation.attemptId}`).digest("hex");
    const response = await paddleApi("transactions", { method: "POST", body: {
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: "automatic",
      custom_data: { userId, billingAttemptId: reservation.attemptId, binding },
    } });
    const data = response.data as { id?: string; items?: Array<{ price?: { id?: string } }> } | undefined;
    if (!data?.id || !TRANSACTION.test(data.id) ||
        !data.items?.some(item => item.price?.id === priceId)) {
      throw new CheckoutError("Paddle transaction identity or product could not be verified.", 503);
    }
    const result = await prisma.billingCheckoutAttempt.updateMany({
      where: { id: reservation.attemptId, userId, status: "CREATING" },
      data: { status: "OPEN", providerCheckoutId: data.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    if (result.count !== 1) throw new CheckoutError("Checkout reservation changed during creation.", 409);
    return { transactionId: data.id, clientToken: token };
  } catch (error) {
    await prisma.billingCheckoutAttempt.updateMany({
      where: { id: reservation.attemptId, userId, status: "CREATING" },
      data: { status: "UNKNOWN" },
    });
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError("Checkout outcome is uncertain. Contact billing support before retrying.", 503);
  }
}

export function paddleCheckoutFailure(error: unknown): { error: string; status: number } {
  return error instanceof CheckoutError ? { error: error.message, status: error.status }
    : { error: "Billing verification is temporarily unavailable.", status: 503 };
}

import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, User, BillingSubscription } from "@/generated/prisma/client";
import * as providers from "./providers";
import { BillingError, type Provider, type Subscription } from "./providers";

type Tx = Prisma.TransactionClient;
const pending = ["CREATING", "OPEN", "UNKNOWN", "PAID_OPEN"];
export const PAID_GRACE_MS = 72 * 60 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export function protectedReview(email: string) {
  return [process.env.REVIEW_USER_EMAIL ?? "fr-josiah-review@orthodoxai.app",
    process.env.REVIEW_CLERGY_USER_EMAIL ?? "clergy-review@orthodoxai.app"]
    .some(value => value.toLowerCase() === email.toLowerCase());
}
async function locked<T>(userId: string, action: (tx: Tx, user: User) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing:${userId}`}, 0))`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new BillingError("User not found.", 404);
    return action(tx, user);
  }, { isolationLevel: "ReadCommitted", timeout: 120000, maxWait: 10000 });
}
export function accessUntil(s: Pick<BillingSubscription, "status" | "paidVerified" | "currentPeriodEndsAt" | "trialEndsAt" | "lastVerifiedAt" | "cancelAtPeriodEnd">): Date | null {
  if (!s.lastVerifiedAt) return null;
  if (["trialing", "on_trial"].includes(s.status)) return s.trialEndsAt;
  if (["active", "cancelled"].includes(s.status) && s.currentPeriodEndsAt) {
    // A known cancellation has no outage extension. Grace is never applied to trials.
    return s.currentPeriodEndsAt;
  }
  return null;
}
async function project(tx: Tx, user: User) {
  const rows = await tx.billingSubscription.findMany({ where: { userId: user.id } });
  const verified = rows.filter(row => row.lastVerifiedAt);
  const until = verified.map(accessUntil).filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  // A partial reconciliation cannot downgrade legacy access owned by an unverified
  // other provider. Staging reconciliation must resolve these rows before cutover.
  if ((!until || until.getTime() <= Date.now()) && rows.some(row => !row.lastVerifiedAt) && user.billingAccessUntil === null) return;
  if (protectedReview(user.email)) return;
  const graceUntil = verified.filter(row => row.status === "active" && row.paidVerified && !row.cancelAtPeriodEnd && row.currentPeriodEndsAt)
    .map(row => new Date(row.currentPeriodEndsAt!.getTime() + PAID_GRACE_MS))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  await tx.user.update({ where: { id: user.id }, data: {
    plan: until && until.getTime() > Date.now() ? "PRO" : "FREE",
    subscriptionStatus: until && until.getTime() > Date.now() ? "active" : "inactive",
    billingAccessUntil: until ?? new Date(0),
    billingGraceUntil: graceUntil ?? null,
  } });
}
export async function refreshAccess(user: User): Promise<User> {
  if (protectedReview(user.email) || (user.billingAccessUntil && user.billingAccessUntil > new Date())) return user;
  // Reconcile legacy references lazily too, including trials previously rejected
  // by the shared status check. A provider failure preserves the legacy snapshot.
  if (!user.billingAccessUntil && !user.subscriptionId && !user.lemonSqueezySubscriptionId &&
      !user.stripeCustomerId && !user.lemonSqueezyCustomerId) return user;
  try {
    return await locked(user.id, async (tx, current) => {
      await inventory(tx, current);
      await project(tx, current);
      return (await tx.user.findUnique({ where: { id: user.id } }))!;
    });
  } catch (error) {
    // Only an existing verified paid grant can survive an outage. Never persist
    // the extension as another paid verification, which would restart the clock.
    let latest: User | null;
    try { latest = await prisma.user.findUnique({ where: { id: user.id } }); }
    catch { return user; }
    if (error instanceof BillingError && error.status === 503 && latest?.plan === "PRO" &&
        latest.subscriptionStatus === "active" && latest.billingGraceUntil && latest.billingGraceUntil > new Date()) {
      return { ...latest, billingAccessUntil: latest.billingGraceUntil };
    }
    return latest ?? user;
  }
}
async function save(tx: Tx, user: User, s: Subscription) {
  const key = { provider: s.provider, providerSubscriptionId: s.providerSubscriptionId };
  const existing = await tx.billingSubscription.findUnique({ where: { provider_providerSubscriptionId: key } });
  if (existing && existing.userId !== user.id) throw new BillingError("Subscription ownership conflict.");
  if (existing?.providerCustomerId && existing.providerCustomerId !== s.providerCustomerId) throw new BillingError("Customer ownership conflict.");
  if (existing?.providerUpdatedAt && s.providerUpdatedAt && existing.providerUpdatedAt > s.providerUpdatedAt) return;
  const { portalUrl: _portalUrl, ...data } = s;
  void _portalUrl;
  await tx.billingSubscription.upsert({ where: { provider_providerSubscriptionId: key },
    create: { ...data, userId: user.id, lastVerifiedAt: new Date() }, update: { ...data, lastVerifiedAt: new Date() } });
  // Never overwrite the current provider pointer with a historical subscription.
  const current = s.provider === "STRIPE" ? user.subscriptionId : user.lemonSqueezySubscriptionId;
  if (!current || current === s.providerSubscriptionId) {
    await tx.user.update({ where: { id: user.id }, data: s.provider === "STRIPE"
      ? { subscriptionId: s.providerSubscriptionId, stripeCustomerId: s.providerCustomerId }
      : { lemonSqueezySubscriptionId: s.providerSubscriptionId, lemonSqueezyCustomerId: s.providerCustomerId,
        lemonSqueezyVariantId: s.providerProductId } });
  }
}
async function inventory(tx: Tx, user: User): Promise<Subscription[]> {
  const rows = await tx.billingSubscription.findMany({ where: { userId: user.id } });
  const customers = new Map<string, { provider: Provider; id: string }>();
  if (user.stripeCustomerId) customers.set(`STRIPE:${user.stripeCustomerId}`, { provider: "STRIPE", id: user.stripeCustomerId });
  if (user.lemonSqueezyCustomerId) customers.set(`LEMONSQUEEZY:${user.lemonSqueezyCustomerId}`, { provider: "LEMONSQUEEZY", id: user.lemonSqueezyCustomerId });
  const references = [
    ...rows.map(row => ({ provider: row.provider as Provider, id: row.providerSubscriptionId })),
    ...(user.subscriptionId ? [{ provider: "STRIPE" as const, id: user.subscriptionId }] : []),
    ...(user.lemonSqueezySubscriptionId ? [{ provider: "LEMONSQUEEZY" as const, id: user.lemonSqueezySubscriptionId }] : []),
  ];
  const subscriptions = new Map<string, Subscription>();
  for (const ref of references) {
    const s = await providers.retrieve(ref.provider, ref.id);
    const expected = s.provider === "STRIPE" ? user.stripeCustomerId : user.lemonSqueezyCustomerId;
    if (expected && expected !== s.providerCustomerId) throw new BillingError("Customer ownership conflict.");
    subscriptions.set(`${s.provider}:${s.providerSubscriptionId}`, s);
    customers.set(`${s.provider}:${s.providerCustomerId}`, { provider: s.provider, id: s.providerCustomerId });
  }
  for (const customer of customers.values()) {
    const field = customer.provider === "STRIPE" ? "stripeCustomerId" : "lemonSqueezyCustomerId";
    const owners = await tx.user.findMany({ where: { [field]: customer.id }, take: 2 });
    if (owners.some(owner => owner.id !== user.id)) throw new BillingError("Ambiguous customer ownership.");
    for (const s of await providers.inventory(customer.provider, customer.id)) {
      if (s.providerCustomerId !== customer.id) throw new BillingError("Provider inventory ownership mismatch.");
      subscriptions.set(`${s.provider}:${s.providerSubscriptionId}`, s);
    }
  }
  for (const s of subscriptions.values()) await save(tx, user, s);
  return [...subscriptions.values()];
}
export async function checkout(userId: string, provider: Provider) {
  const reservation = await locked(userId, async (tx, user) => {
    if (!user.emailVerified) throw new BillingError("Please verify your email address before upgrading to OrthodoxAI Pro.", 403);
    if (protectedReview(user.email)) throw new BillingError("Billing is unavailable for review accounts.", 403);
    if (user.billingDeletionRequestedAt) throw new BillingError("Account deletion is pending; billing recovery is required.");
    const existing = await tx.billingCheckoutAttempt.findFirst({ where: { userId, status: { in: pending } } });
    if (existing) {
      if (existing.status === "OPEN" && existing.provider === provider && existing.checkoutUrl &&
          existing.expiresAt && existing.expiresAt > new Date()) {
        if ((await inventory(tx, user)).some(s => !providers.terminal(s))) throw new BillingError("An existing subscription must be managed through the billing portal.");
        return { url: existing.checkoutUrl };
      }
      throw new BillingError("A checkout is already pending; reconciliation is required before another purchase.");
    }
    const subscriptions = await inventory(tx, user);
    if (subscriptions.some(s => !providers.terminal(s))) throw new BillingError("An existing subscription must be managed through the billing portal.");
    const attempt = await tx.billingCheckoutAttempt.create({ data: { userId, provider } });
    return { attempt, user };
  });
  if ("url" in reservation) return { url: reservation.url };
  const { attempt, user } = reservation;
  try {
    const result = await providers.createCheckout(provider, user, attempt.id);
    await locked(userId, async tx => {
      await tx.billingCheckoutAttempt.updateMany({ where: { id: attempt.id, status: "CREATING" }, data: { status: "OPEN",
        providerCheckoutId: result.id, checkoutUrl: result.url, expiresAt: result.expiresAt } });
      if (result.customerId) await tx.user.update({ where: { id: userId }, data: { stripeCustomerId: result.customerId } });
    });
    return { url: result.url };
  } catch {
    await locked(userId, async tx => { await tx.billingCheckoutAttempt.updateMany({ where: { id: attempt.id, status: "CREATING" }, data: { status: "UNKNOWN" } }); });
    throw new BillingError("Checkout outcome is uncertain. Contact billing support before retrying.", 503);
  }
}
export async function deleteAccount(userId: string) {
  // Commit the fence BEFORE any network request; cancellation failures must retain it.
  await locked(userId, async (tx, user) => {
    if (protectedReview(user.email)) throw new BillingError("This review account cannot be deleted.", 403);
    await tx.user.update({ where: { id: userId }, data: { billingDeletionRequestedAt: user.billingDeletionRequestedAt ?? new Date() } });
  });
  await locked(userId, async (tx, user) => {
    if (await tx.billingCheckoutAttempt.findFirst({ where: { userId, status: { in: pending } } })) {
      throw new BillingError("Pending checkout must be reconciled before account deletion.");
    }
    const subscriptions = await inventory(tx, user);
    for (const s of subscriptions) await providers.cancel(s);
    // Fetch the complete inventory again: do not trust cancellation responses.
    const after = await inventory(tx, user);
    if (after.some(s => !providers.terminal(s))) throw new BillingError("Subscription cancellation is not yet verified. Your account was retained.");
    const customers = new Map<string, Subscription>();
    for (const s of after) customers.set(`${s.provider}:${s.providerCustomerId}`, s);
    if (user.stripeCustomerId) await providers.assertNoDebt("STRIPE", user.stripeCustomerId);
    if (user.lemonSqueezyCustomerId) await providers.assertNoDebt("LEMONSQUEEZY", user.lemonSqueezyCustomerId);
    for (const s of customers.values()) await providers.assertNoDebt(s.provider, s.providerCustomerId);
    const retainedUntil = new Date(Date.now() + RETENTION_MS);
    await tx.billingSubscription.updateMany({ where: { userId }, data: { retainedUntil } });
    await tx.billingCheckoutAttempt.updateMany({ where: { userId }, data: { retainedUntil, checkoutUrl: null } });
    await tx.user.delete({ where: { id: userId } });
  });
}
export type Notice = { provider: Provider; eventId: string; eventType: string; subscriptionId: string;
  customerId?: string; userId?: string; attemptId?: string; rawBody: string; occurredAt?: Date };
export async function webhook(notice: Notice) {
  const key = { provider: notice.provider, providerSubscriptionId: notice.subscriptionId };
  const row = await prisma.billingSubscription.findUnique({ where: { provider_providerSubscriptionId: key } });
  // Tombstones deliberately cannot reattach deleted accounts via stale metadata.
  if (row && !row.userId) return;
  const customerField = notice.provider === "STRIPE" ? "stripeCustomerId" : "lemonSqueezyCustomerId";
  const matches = notice.customerId ? await prisma.user.findMany({ where: { [customerField]: notice.customerId }, take: 2 }) : [];
  if (matches.length > 1) throw new BillingError("Ambiguous billing customer mapping.");
  const userId = row?.userId ?? matches[0]?.id ?? notice.userId;
  if (!userId) throw new BillingError("Subscription owner could not be verified.");
  await locked(userId, async (tx, user) => {
    const receiptKey = { provider: notice.provider, eventId: notice.eventId };
    const digest = createHash("sha256").update(notice.rawBody).digest("hex");
    const receipt = await tx.billingWebhookEvent.findUnique({ where: { provider_eventId: receiptKey } });
    if (receipt && receipt.payloadDigest !== digest) throw new BillingError("Webhook identity collision.");
    if (receipt?.status === "PROCESSED") return;
    const s = await providers.retrieve(notice.provider, notice.subscriptionId);
    if (notice.customerId && notice.customerId !== s.providerCustomerId) throw new BillingError("Webhook customer mismatch.");
    const expected = notice.provider === "STRIPE" ? user.stripeCustomerId : user.lemonSqueezyCustomerId;
    const attempt = notice.attemptId ? await tx.billingCheckoutAttempt.findUnique({ where: { id: notice.attemptId } }) : null;
    if (expected ? expected !== s.providerCustomerId : !(row?.userId === user.id ||
        (attempt?.userId === user.id && attempt.provider === notice.provider))) {
      throw new BillingError("Unverified subscription/customer association.");
    }
    if (notice.userId && notice.userId !== user.id) throw new BillingError("Webhook owner mismatch.");
    await save(tx, user, s);
    await project(tx, user);
    // Only the matching durable attempt can be marked completed; another hosted
    // checkout remains fenced even if an older subscription emits a webhook.
    if (attempt?.userId === user.id && attempt.provider === notice.provider) {
      await tx.billingCheckoutAttempt.update({ where: { id: attempt.id }, data: {
        // Lemon hosted links may remain reusable after payment. Keep them fenced
        // until a fresh provider read proves closure; Stripe sessions are consumed.
        status: notice.provider === "STRIPE" ? "COMPLETED" : "PAID_OPEN", checkoutUrl: null } });
    }
    await tx.billingWebhookEvent.upsert({ where: { provider_eventId: receiptKey }, create: {
      ...receiptKey, eventType: notice.eventType, providerSubscriptionId: notice.subscriptionId,
      payloadDigest: digest, occurredAt: notice.occurredAt, status: "PROCESSED", processedAt: new Date(),
    }, update: { status: "PROCESSED", processedAt: new Date() } });
  });
}
function audit(previous: Prisma.JsonValue | null, actor: string, reason: string, action: string): Prisma.InputJsonValue {
  return [...(Array.isArray(previous) ? previous : []), { at: new Date().toISOString(), actor, reason, action }] as Prisma.InputJsonValue;
}
export async function recover(userId: string, actorId: string, reason: string) {
  if (reason.trim().length < 10 || reason.length > 500) throw new BillingError("A recovery reason of 10–500 characters is required.", 400);
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const admins = (process.env.BILLING_ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!actor?.emailVerified || !admins.includes(actorId)) throw new BillingError("Billing recovery administrator required.", 403);
  // Persist the recovery request even if provider verification later fails.
  await locked(userId, async (tx, user) => {
    await tx.user.update({ where: { id: userId }, data: {
      billingRecoveryLog: audit(user.billingRecoveryLog, actorId, reason, "RECOVERY_REQUESTED") } });
  });
  await locked(userId, async (tx, user) => {
    const subscriptions = await inventory(tx, user);
    const attempts = await tx.billingCheckoutAttempt.findMany({ where: { userId, status: { in: pending } } });
    for (const attempt of attempts) {
      if (!attempt.providerCheckoutId || !await providers.checkoutClosed(attempt.provider as Provider, attempt.providerCheckoutId)) {
        throw new BillingError("Checkout closure is unproven. Fence retained; provider investigation required.");
      }
      await tx.billingCheckoutAttempt.update({ where: { id: attempt.id }, data: { status: "RECONCILED", checkoutUrl: null,
        recoveryLog: audit(attempt.recoveryLog, actorId, reason, "PROVIDER_CONFIRMED_CLOSED") } });
    }
    await project(tx, user);
    // Recovery abandons deletion, never deletes data. Active billing is allowed
    // only because the account remains; checkout still checks the full inventory.
    await tx.user.update({ where: { id: userId }, data: { billingDeletionRequestedAt: null,
      billingRecoveryLog: audit(user.billingRecoveryLog, actorId, reason,
        `DELETION_ABORTED;VERIFIED_SUBSCRIPTIONS=${subscriptions.length}`) } });
  });
}
export async function billingPortal(userId: string, requested?: Provider) {
  return locked(userId, async (tx, user) => {
    if (protectedReview(user.email)) throw new BillingError("Billing portal is not available for review accounts.", 403);
    const subscriptions = await inventory(tx, user);
    const candidates = subscriptions.filter(s => !requested || s.provider === requested);
    const live = candidates.filter(s => !providers.terminal(s));
    const available = live.length ? live : candidates;
    if (new Set(available.map(s => s.provider)).size > 1) throw new BillingError("Multiple billing providers require separate management. Contact billing support.");
    const s = available[0];
    if (!s) throw new BillingError("No subscription was found.", 404);
    return { url: await providers.portal(s.provider, s.providerCustomerId, s.providerSubscriptionId) };
  });
}

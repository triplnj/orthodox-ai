import "server-only";
import type { User, BillingSubscription } from "@/generated/prisma/client";
import { reviewIdentities } from "@/lib/security/review-identities";

export const PAID_GRACE_MS = 72 * 60 * 60 * 1000;
export type BillingUser = User & { legacyReconciliationDeadlineAt?: Date | null; reviewAccess?: boolean };
export function reviewAccess(user: BillingUser) {
  return reviewIdentities().some(identity => identity.id === user.id && identity.email === user.email.toLowerCase()) &&
    user.passwordHash === null && Boolean(user.emailVerified) && user.plan === "PRO" && user.subscriptionStatus === "active" &&
    !user.billingDeletionRequestedAt && !user.subscriptionId && !user.lemonSqueezySubscriptionId && !user.stripeCustomerId && !user.lemonSqueezyCustomerId &&
    !user.billingAccessUntil && !user.billingGraceUntil;
}
export function accessUntil(s: Pick<BillingSubscription, "status" | "paidVerified" | "currentPeriodEndsAt" | "trialEndsAt" | "lastVerifiedAt" | "cancelAtPeriodEnd">): Date | null {
  if (!s.lastVerifiedAt) return null;
  if (["trialing", "on_trial"].includes(s.status)) return s.trialEndsAt;
  if (["active", "cancelled"].includes(s.status)) return s.currentPeriodEndsAt;
  return null;
}
export type ReconciliationState = { unavailable?: ReadonlySet<string>; conflicted?: ReadonlySet<string>; complete?: boolean };
const future = (value: Date | null | undefined, now: Date) => value instanceof Date && Number.isFinite(value.getTime()) && value > now;
export function entitlement(user: BillingUser, rows: BillingSubscription[], state: ReconciliationState = {}, now = new Date()) {
  // Only rows already associated with this user and a matching provider customer
  // can support access. One conflicted provider cannot authorize another grant.
  const conflicts = new Set(state.conflicted);
  for (const row of rows) {
    const expected = row.provider === "STRIPE" ? user.stripeCustomerId : user.lemonSqueezyCustomerId;
    if (row.userId !== user.id || !["STRIPE", "LEMONSQUEEZY"].includes(row.provider) ||
        (expected && expected !== row.providerCustomerId)) conflicts.add(row.provider);
  }
  const owned = rows.filter(row => !conflicts.has(row.provider));
  const verified = owned.filter(row => row.lastVerifiedAt);
  const grants = verified.map(accessUntil).filter((date): date is Date => future(date, now));
  const paidGrace = verified.filter(row => row.status === "active" && row.paidVerified && !row.cancelAtPeriodEnd && row.currentPeriodEndsAt && state.unavailable?.has(row.provider))
    .map(row => new Date(row.currentPeriodEndsAt!.getTime() + PAID_GRACE_MS)).filter(date => future(date, now));
  // The marker alone is insufficient. A candidate must still have its preserved
  // pre-cutover active-PRO snapshot, an unresolved inventory, and no ownership
  // conflict or already-known non-active verified provider evidence.
  const terminal = ["canceled", "cancelled", "expired", "incomplete_expired", "unpaid", "past_due", "paused"];
  const knownInvalid = verified.some(row => row.status !== "active" || !future(row.currentPeriodEndsAt, now)) ||
    owned.some(row => terminal.includes(row.status) || Boolean(row.legacySnapshotStatus && terminal.includes(row.legacySnapshotStatus)));
  const unresolved = !state.complete && [...state.unavailable ?? []].some(provider =>
    (provider === "STRIPE" && Boolean(user.subscriptionId || user.stripeCustomerId)) ||
    (provider === "LEMONSQUEEZY" && Boolean(user.lemonSqueezySubscriptionId || user.lemonSqueezyCustomerId)) ||
    owned.some(row => row.provider === provider && !row.lastVerifiedAt && Boolean(row.providerSubscriptionId)));
  const legacy = user.plan === "PRO" && user.subscriptionStatus === "active" && user.billingAccessUntil === null &&
    !user.billingDeletionRequestedAt && !conflicts.size && verified.length === 0 && !knownInvalid && unresolved && future(user.legacyReconciliationDeadlineAt, now)
    ? user.legacyReconciliationDeadlineAt! : null;
  const until = [...grants, ...paidGrace, ...(legacy ? [legacy] : [])].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { plan: until ? "PRO" as const : "FREE" as const, subscriptionStatus: until ? "active" : "inactive", billingAccessUntil: until ?? new Date(0),
    source: grants.some(date => until && date.getTime() === until.getTime()) ? "verified" : paidGrace.some(date => until && date.getTime() === until.getTime()) ? "paid_grace" : legacy ? "legacy" : "none" };
}

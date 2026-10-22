import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@/generated/prisma/client";
import { createSessionRecord, setSessionCookie } from "@/lib/session";
import { reviewIdentity, ReviewIdentityError, type ReviewKind } from "./review-identities";
import { diagnostic } from "@/lib/diagnostics";

export function validReviewAccessToken(kind: ReviewKind, token: string | null) {
  const expected = kind === "clergy" ? process.env.REVIEW_CLERGY_ACCESS_TOKEN : process.env.REVIEW_ACCESS_TOKEN;
  return Boolean(expected && token && timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(token).digest()));
}
function safeExisting(user: User) {
  return user.passwordHash === null && Boolean(user.emailVerified) && user.plan === "PRO" && user.subscriptionStatus === "active" &&
    !user.billingDeletionRequestedAt && !user.subscriptionId && !user.lemonSqueezySubscriptionId && !user.stripeCustomerId && !user.lemonSqueezyCustomerId &&
    !user.lemonSqueezyOrderId && !user.lemonSqueezyVariantId && !user.billingAccessUntil && !user.billingGraceUntil;
}
async function locked<T>(kind: ReviewKind, work: (tx: Prisma.TransactionClient, identity: ReturnType<typeof reviewIdentity>, user: User | null) => Promise<T>) {
  const identity = reviewIdentity(kind);
  return prisma.$transaction(async tx => {
    // Match registration and all password/session mutations; order is always email then user.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`auth-register:${identity.email}`}, 0))`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`auth-user:${identity.id}`}, 0))`;
    const byId = await tx.user.findUnique({ where: { id: identity.id } });
    const byEmail = await tx.user.findUnique({ where: { email: identity.email } });
    if ((byId && byId.email !== identity.email) || (byEmail && byEmail.id !== identity.id) || (byId && !safeExisting(byId))) {
      throw new ReviewIdentityError(409, "REVIEW_IDENTITY_CONFLICT");
    }
    if (byId && (await tx.billingSubscription.findFirst({ where: { userId: byId.id } }) || await tx.billingCheckoutAttempt.findFirst({ where: { userId: byId.id } }))) {
      throw new ReviewIdentityError(409, "REVIEW_IDENTITY_CONFLICT");
    }
    return work(tx, identity, byId);
  }, { isolationLevel: "ReadCommitted", timeout: 20000, maxWait: 10000 });
}
export async function startReviewSession(kind: ReviewKind) {
  const session = await locked(kind, async (tx, identity, existing) => {
    const user = existing ?? await tx.user.create({ data: {
      id: identity.id, email: identity.email, passwordHash: null,
      name: kind === "clergy" ? "Clergy Review" : "Fr. Josiah Review", plan: "PRO", subscriptionStatus: "active", emailVerified: new Date(),
      onboardingCompleted: true, spiritualGoal: kind === "clergy" ? "review OrthodoxAI for theological and pastoral safety" : "learn Orthodox basics",
      experienceLevel: "advanced", dailyTime: "15 minutes",
    } });
    return createSessionRecord(tx, user.id);
  });
  await setSessionCookie(session.token, session.expiresAt);
}

/** Operator-only library entry point. Never expose through a user-facing route. */
export async function transitionLegacyReviewIdentity(kind: ReviewKind, authorization: { actor: string; reference: string; confirmUserId: string }) {
  const identity = reviewIdentity(kind);
  if (!authorization.actor?.trim() || !authorization.reference?.trim() || authorization.confirmUserId !== identity.id) {
    throw new ReviewIdentityError(403, "REVIEW_TRANSITION_NOT_AUTHORIZED");
  }
  const result = await locked(kind, async (tx, _identity, user) => {
    if (!user) throw new ReviewIdentityError(409, "REVIEW_IDENTITY_CONFLICT");
    const now = new Date();
    const sessions = await tx.session.deleteMany({ where: { userId: user.id } });
    const resets = await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const verifications = await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    return { kind, userId: user.id, sessionsRevoked: sessions.count, resetTokensInvalidated: resets.count, verificationTokensInvalidated: verifications.count };
  });
  // Structured evidence; operator must retain this in the approved change/audit record.
  diagnostic("review_transition", { operation: "review", outcome: "succeeded", sessionsRevoked: result.sessionsRevoked,
    resetTokensInvalidated: result.resetTokensInvalidated, verificationTokensInvalidated: result.verificationTokensInvalidated });
  return result;
}

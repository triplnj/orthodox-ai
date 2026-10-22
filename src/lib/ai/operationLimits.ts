import "server-only";
import { diagnostic } from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { FREE_DAILY_CHAT_LIMIT, FULL_ACCESS_DAILY_CHAT_LIMIT, CHAT_RATE_LIMIT_PER_MINUTE } from "@/lib/features";
import { isProUser, type AppUser } from "@/lib/subscription";
import { quotaDay } from "./quotaClock";
import type { Prisma } from "@/generated/prisma/client";

export type AiFeature = "chat" | "prayer-plan" | "fasting-plan" | "scripture-plan" | "journal-summary" | "review" | "research";
export const PERSONAL_FEATURES = ["prayer-plan", "fasting-plan", "scripture-plan", "journal-summary"];
const LEASE_MS = 5 * 60_000;

export class AiLimitError extends Error {
  constructor(readonly status: number, readonly limitType: string, message: string, readonly upgradeRequired = false,
    readonly quota?: QuotaSnapshot, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "AiLimitError";
  }
}
export type QuotaSnapshot = { pool: string; limit: number; used: number; remaining: number; observedAt: string; resetsAt: string; timezone: string };
export async function quotaSnapshot(subject: string, feature: AiFeature, user?: AppUser, tx: Prisma.TransactionClient = prisma, now = new Date()): Promise<QuotaSnapshot> {
  if (tx === prisma) return prisma.$transaction(async locked => {
    await locked.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`ai:${subject}`}, 0))`;
    return quotaSnapshot(subject, feature, user, locked, new Date());
  });
  const day = quotaDay(now);
  const limit = feature === "chat" ? (user && isProUser(user) ? FULL_ACCESS_DAILY_CHAT_LIMIT : FREE_DAILY_CHAT_LIMIT) : feature === "review" ? 100 : 30;
  const used = feature === "chat" && user ? await tx.usageLog.count({ where: { userId: user.id, feature: "chat", createdAt: { gte: day.start } } })
    : await tx.aiReservation.count({ where: { subject, createdAt: { gte: day.start }, feature: { in: PERSONAL_FEATURES.includes(feature) ? PERSONAL_FEATURES : [feature] } } });
  return { pool: PERSONAL_FEATURES.includes(feature) ? "personal" : feature, limit, used, remaining: Math.max(0, limit - used), observedAt: now.toISOString(), resetsAt: day.reset.toISOString(), timezone: day.timezone };
}

export async function reserveAiOperation(subject: string, feature: AiFeature, user?: AppUser,
  identity?: { requestKey: string; requestHash: string }) {
  if ((feature === "chat" || PERSONAL_FEATURES.includes(feature)) && !user) {
    throw new AiLimitError(401, "authentication", "You must be signed in.");
  }
  if (PERSONAL_FEATURES.includes(feature) && user && !isProUser(user)) {
    throw new AiLimitError(403, "subscription", "This feature requires Full Access.", true);
  }
  return prisma.$transaction(async (tx) => {
    // Transaction-scoped PostgreSQL lock serializes admission across instances.
    // Return an integer rather than PostgreSQL's void lock result for Prisma.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`ai:${subject}`}, 0))`;
    const now = new Date();
    if (identity) {
      const previous = await tx.aiReservation.findFirst({ where: { subject, feature, requestKey: identity.requestKey } });
      if (previous) return { id: previous.id, remaining: 0, previous };
    }
    const since = new Date(now.getTime() - 60_000);
    const quota = await quotaSnapshot(subject, feature, user, tx, now);
    const running = await tx.aiReservation.count({
      where: { subject, status: { in: ["RUNNING", "ABANDONED"] }, expiresAt: { gt: now } },
    });
    if (running >= 1) throw new AiLimitError(429, "concurrency", "Another AI operation is in progress. Please wait.", false, quota);
    const recent = await tx.aiReservation.count({ where: { subject, createdAt: { gte: since } } });
    const legacyRecent = feature === "chat" && user
      ? await tx.usageLog.count({ where: { userId: user.id, feature: "chat", createdAt: { gte: since } } }) : 0;
    if (recent >= CHAT_RATE_LIMIT_PER_MINUTE || legacyRecent >= CHAT_RATE_LIMIT_PER_MINUTE) {
      throw new AiLimitError(429, "rate", "You are sending requests too quickly. Please wait a minute.", false, quota, 60);
    }
    const dailyLimit = quota.limit;
    const used = quota.used;
    if (used >= dailyLimit) {
      throw new AiLimitError(429, "daily", "You have reached today's AI usage limit. Please try again tomorrow.",
        feature === "chat" && Boolean(user && !isProUser(user)), quota, Math.max(1, Math.ceil((new Date(quota.resetsAt).getTime() - now.getTime()) / 1000)));
    }
    const reservation = await tx.aiReservation.create({
      data: { subject, feature, expiresAt: new Date(now.getTime() + LEASE_MS), ...(identity ? { ...identity, userId: user!.id } : {}) },
    });
    if (feature === "chat" && user) {
      // Charge before external work; preserve legacy usage views and quotas.
      await tx.usageLog.create({ data: { userId: user.id, feature: "chat" } });
    }
    return { id: reservation.id, remaining: dailyLimit - used - 1, previous: null };
  }, { maxWait: 10_000, timeout: 15_000, isolationLevel: "ReadCommitted" });
}

export async function withAiOperation<T>(subject: string, feature: AiFeature, user: AppUser | undefined,
  work: (reservation: { id: string; remaining: number }) => Promise<T>): Promise<T> {
  const reservation = await reserveAiOperation(subject, feature, user);
  let failed = true;
  let renewing: Promise<unknown> | undefined;
  const heartbeat = setInterval(() => {
    if (renewing) return;
    renewing = prisma.aiReservation.updateMany({
      where: { id: reservation.id, status: "RUNNING" },
      data: { expiresAt: new Date(Date.now() + LEASE_MS) },
    }).catch(() => diagnostic("operation_failed", { operation: "heartbeat", failure: "database" }))
      .finally(() => { renewing = undefined; });
  }, 30_000);
  heartbeat.unref();
  try {
    const result = await work(reservation);
    failed = result instanceof Response && result.status >= 400;
    return result;
  } finally {
    clearInterval(heartbeat);
    await renewing;
    await prisma.aiReservation.updateMany({
      where: { id: reservation.id, status: "RUNNING" },
      data: { status: failed ? "FAILED" : "COMPLETED", finishedAt: new Date() },
    });
  }
}

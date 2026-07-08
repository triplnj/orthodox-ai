import { prisma } from "@/lib/prisma";
import {
  CHAT_RATE_LIMIT_PER_MINUTE,
  FREE_DAILY_CHAT_LIMIT,
  FULL_ACCESS_DAILY_CHAT_LIMIT,
} from "@/lib/features";
import { isProUser, type AppUser } from "@/lib/subscription";

export async function getTodayUsage(userId: string, feature: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.usageLog.count({
    where: {
      userId,
      feature,
      createdAt: {
        gte: startOfDay,
      },
    },
  });
}

export async function getRecentUsage(
  userId: string,
  feature: string,
  seconds: number
) {
  const since = new Date(Date.now() - seconds * 1000);

  return prisma.usageLog.count({
    where: {
      userId,
      feature,
      createdAt: {
        gte: since,
      },
    },
  });
}

export async function canUseChat(user: AppUser) {
  const isFullAccess = isProUser(user);

  const [usedToday, usedLastMinute] = await Promise.all([
    getTodayUsage(user.id, "chat"),
    getRecentUsage(user.id, "chat", 60),
  ]);

  if (usedLastMinute >= CHAT_RATE_LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      remaining: null,
      dailyLimit: isFullAccess
        ? FULL_ACCESS_DAILY_CHAT_LIMIT
        : FREE_DAILY_CHAT_LIMIT,
      reason:
        "You are sending questions too quickly. Please wait a minute and try again.",
      status: 429,
      limitType: "rate" as const,
    };
  }

  const dailyLimit = isFullAccess
    ? FULL_ACCESS_DAILY_CHAT_LIMIT
    : FREE_DAILY_CHAT_LIMIT;

  if (usedToday >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit,
      reason: isFullAccess
        ? "You have reached today's Full Access fair-use limit. Please try again tomorrow."
        : "You have reached your daily Free limit. Get Full Access for expanded AI usage and personal spiritual tools.",
      status: 429,
      limitType: "daily" as const,
    };
  }

  return {
    allowed: true,
    remaining: dailyLimit - usedToday,
    dailyLimit,
    reason: null,
    status: 200,
    limitType: null,
  };
}

export async function logUsage(userId: string, feature: string) {
  await prisma.usageLog.create({
    data: {
      userId,
      feature,
    },
  });
}
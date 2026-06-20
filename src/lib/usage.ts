import { prisma } from "@/lib/prisma";
import { FREE_DAILY_CHAT_LIMIT } from "@/lib/features";
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

export async function canUseChat(user: AppUser) {
  if (isProUser(user)) {
    return {
      allowed: true,
      remaining: null,
      reason: null,
    };
  }

  const usedToday = await getTodayUsage(user.id, "chat");

  if (usedToday >= FREE_DAILY_CHAT_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      reason:
        "You have reached your daily Free limit. Upgrade to OrthodoxAI Pro for unlimited questions and personal spiritual tools.",
    };
  }

  return {
    allowed: true,
    remaining: FREE_DAILY_CHAT_LIMIT - usedToday,
    reason: null,
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
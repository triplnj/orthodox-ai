import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { ApiError } from "@/lib/api/validation";
import { apiFailure } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { FREE_DAILY_CHAT_LIMIT } from "@/lib/features";
import { buildDailyRhythm } from "@/lib/dailyRhythm";
import { quotaSnapshot } from "@/lib/ai/operationLimits";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to view your dashboard." },
        { status: 401 }
      );
    }

    const isPro = isProUser(user);

    const dbUser = await prisma.user.findUnique({
  where: {
    id: user.id,
  },
  select: {
    id: true,
    email: true,
    name: true,
    emailVerified: true,
    onboardingCompleted: true,
    spiritualGoal: true,
    experienceLevel: true,
    dailyTime: true,
    plan: true,
    subscriptionStatus: true,
  },
});

if (!dbUser) {
  return apiJson(
    { error: "User not found." },
    { status: 404 }
  );
}

const dailyRhythm = buildDailyRhythm({
  spiritualGoal: dbUser.spiritualGoal,
  experienceLevel: dbUser.experienceLevel,
  dailyTime: dbUser.dailyTime,
});

    const quota = await quotaSnapshot(user.id, "chat", user);

    const [chatCount, journalCount, todayChatUsage, recentMessages, recentJournalEntries] =
      await Promise.all([
        prisma.chatMessage.count({
          where: {
            userId: user.id,
          },
        }),

        prisma.journalEntry.count({
          where: {
            userId: user.id,
          },
        }),

        Promise.resolve(quota.used),

        prisma.chatMessage.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        }),

        prisma.journalEntry.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        }),
      ]);

    return apiJson({
      user: { ...dbUser, plan: user.plan, subscriptionStatus: user.subscriptionStatus, billingAccessUntil: user.billingAccessUntil, reviewAccess: user.reviewAccess === true, adminAccess: user.adminAccess === true },
      isPro,
      stats: {
        quota, remainingQuestions: quota.remaining,
        chatCount,
        journalCount,
        todayChatUsage,
        freeDailyChatLimit: FREE_DAILY_CHAT_LIMIT,
        remainingFreeQuestions: isPro
          ? null
          : Math.max(FREE_DAILY_CHAT_LIMIT - todayChatUsage, 0),
      },
      dailyRhythm,
      recentMessages,
      recentJournalEntries,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "dashboard", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while loading dashboard data." },
      { status: 500 }
    );
  }
}

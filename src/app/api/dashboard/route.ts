import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { FREE_DAILY_CHAT_LIMIT } from "@/lib/features";
import { buildDailyRhythm } from "@/lib/dailyRhythm";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
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
  return NextResponse.json(
    { error: "User not found." },
    { status: 404 }
  );
}

const dailyRhythm = buildDailyRhythm({
  spiritualGoal: dbUser.spiritualGoal,
  experienceLevel: dbUser.experienceLevel,
  dailyTime: dbUser.dailyTime,
});

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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

        prisma.usageLog.count({
          where: {
            userId: user.id,
            feature: "chat",
            createdAt: {
              gte: startOfDay,
            },
          },
        }),

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

    return NextResponse.json({
      user: dbUser,
      isPro,
      stats: {
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
    console.error("DASHBOARD_GET_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading dashboard data." },
      { status: 500 }
    );
  }
}
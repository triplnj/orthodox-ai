import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to view your account." },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionId: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const chatCount = await prisma.chatMessage.count({
      where: {
        userId: user.id,
      },
    });

    const journalCount = await prisma.journalEntry.count({
      where: {
        userId: user.id,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.usageLog.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: today,
        },
      },
    });

    return NextResponse.json({
      user: dbUser,
      isPro: isProUser({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        plan: dbUser.plan,
        subscriptionStatus: dbUser.subscriptionStatus,
      }),
      stats: {
        chatCount,
        journalCount,
        todayUsage,
      },
    });
  } catch (error) {
    console.error("ACCOUNT_GET_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading account data." },
      { status: 500 }
    );
  }
}
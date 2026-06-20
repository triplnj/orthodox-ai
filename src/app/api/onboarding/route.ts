import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to complete onboarding." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const spiritualGoal = String(body.spiritualGoal ?? "").trim();
    const experienceLevel = String(body.experienceLevel ?? "").trim();
    const dailyTime = String(body.dailyTime ?? "").trim();

    if (!spiritualGoal || !experienceLevel || !dailyTime) {
      return NextResponse.json(
        { error: "All onboarding fields are required." },
        { status: 400 }
      );
    }

    const allowedGoals = [
      "build prayer habit",
      "understand fasting",
      "read Scripture",
      "use spiritual journal",
      "learn Orthodox basics",
    ];

    const allowedExperienceLevels = [
      "beginner",
      "returning",
      "regular but inconsistent",
      "experienced",
    ];

    const allowedDailyTimes = [
      "5 minutes",
      "10 minutes",
      "15 minutes",
      "20 minutes",
      "30 minutes",
    ];

    if (!allowedGoals.includes(spiritualGoal)) {
      return NextResponse.json(
        { error: "Invalid spiritual goal." },
        { status: 400 }
      );
    }

    if (!allowedExperienceLevels.includes(experienceLevel)) {
      return NextResponse.json(
        { error: "Invalid experience level." },
        { status: 400 }
      );
    }

    if (!allowedDailyTimes.includes(dailyTime)) {
      return NextResponse.json(
        { error: "Invalid daily time." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        spiritualGoal,
        experienceLevel,
        dailyTime,
        onboardingCompleted: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        onboardingCompleted: true,
        spiritualGoal: true,
        experienceLevel: true,
        dailyTime: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
    });
  } catch (error) {
    console.error("ONBOARDING_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while saving onboarding." },
      { status: 500 }
    );
  }
}
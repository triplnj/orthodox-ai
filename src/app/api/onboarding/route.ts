import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiFailure, parse, readJson, onboardingSchema } from "@/lib/api/validation";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to complete onboarding." },
        { status: 401 }
      );
    }

    const body = parse(onboardingSchema, await readJson(req, 16384));

    const spiritualGoal = String(body.spiritualGoal ?? "").trim();
    const experienceLevel = String(body.experienceLevel ?? "").trim();
    const dailyTime = String(body.dailyTime ?? "").trim();

    if (!spiritualGoal || !experienceLevel || !dailyTime) {
      return apiJson(
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
      return apiJson(
        { error: "Invalid spiritual goal." },
        { status: 400 }
      );
    }

    if (!allowedExperienceLevels.includes(experienceLevel)) {
      return apiJson(
        { error: "Invalid experience level." },
        { status: 400 }
      );
    }

    if (!allowedDailyTimes.includes(dailyTime)) {
      return apiJson(
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

    return apiJson({
      user: updatedUser,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "profile", failure: failureCategory(error) });

    return apiFailure(error);
  }
}

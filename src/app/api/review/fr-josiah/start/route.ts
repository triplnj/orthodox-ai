import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

function isValidReviewToken(token: string | null) {
  const expectedToken = process.env.REVIEW_ACCESS_TOKEN;

  if (!expectedToken) {
    return false;
  }

  return token === expectedToken;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!isValidReviewToken(token)) {
      return NextResponse.json(
        { error: "Review access is invalid or expired." },
        { status: 401 }
      );
    }

    const reviewEmail =
      process.env.REVIEW_USER_EMAIL ?? "fr-josiah-review@orthodoxai.app";

    const reviewUser = await prisma.user.upsert({
      where: {
        email: reviewEmail,
      },
      update: {
        name: "Fr. Josiah Review",
        plan: "PRO",
        subscriptionStatus: "active",
        emailVerified: new Date(),
        onboardingCompleted: true,
        spiritualGoal: "learn Orthodox basics",
        experienceLevel: "advanced",
        dailyTime: "15 minutes",
      },
      create: {
        email: reviewEmail,
        name: "Fr. Josiah Review",
        plan: "PRO",
        subscriptionStatus: "active",
        emailVerified: new Date(),
        onboardingCompleted: true,
        spiritualGoal: "learn Orthodox basics",
        experienceLevel: "advanced",
        dailyTime: "15 minutes",
      },
      select: {
        id: true,
      },
    });

    await createSession(reviewUser.id);

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error("REVIEW_START_ERROR:", error);

    return NextResponse.json(
      { error: "Could not start review access." },
      { status: 500 }
    );
  }
}
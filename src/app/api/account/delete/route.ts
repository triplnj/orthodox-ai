import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "on_trial",
  "paused",
  "past_due",
  "unpaid",
];

export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be signed in to delete your account." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: currentUser.id,
      },
      select: {
        id: true,
        lemonSqueezySubscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account was not found." },
        { status: 404 }
      );
    }

    const subscriptionStatus =
      user.subscriptionStatus?.toLowerCase() ?? "";

    const hasActiveSubscription =
      Boolean(user.lemonSqueezySubscriptionId) &&
      ACTIVE_SUBSCRIPTION_STATUSES.includes(subscriptionStatus);

    if (hasActiveSubscription) {
      return NextResponse.json(
        {
          error:
            "Please cancel your Full Access subscription before deleting your account.",
          subscriptionActive: true,
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "Your account has been deleted.",
    });

    response.cookies.set("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("DELETE_ACCOUNT_ERROR:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong while deleting your account. Your account was not deleted.",
      },
      { status: 500 }
    );
  }
}
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

    const hasActiveSubscription =
      Boolean(user.lemonSqueezySubscriptionId) &&
      ACTIVE_SUBSCRIPTION_STATUSES.includes(
        user.subscriptionStatus?.toLowerCase() ?? ""
      );

    if (hasActiveSubscription) {
      const apiKey = process.env.LEMONSQUEEZY_API_KEY;

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "Billing is not configured correctly. Your account was not deleted. Please contact support.",
          },
          { status: 500 }
        );
      }

      const cancelResponse = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonSqueezySubscriptionId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            Authorization: `Bearer ${apiKey}`,
          },
          cache: "no-store",
        }
      );

      if (!cancelResponse.ok) {
        const errorBody = await cancelResponse.text();

        console.error("LEMON_SQUEEZY_CANCEL_ERROR:", {
          status: cancelResponse.status,
          body: errorBody,
          userId: user.id,
          subscriptionId: user.lemonSqueezySubscriptionId,
        });

        return NextResponse.json(
          {
            error:
              "Your subscription could not be cancelled, so your account was not deleted. Please try again or contact support.",
          },
          { status: 502 }
        );
      }
    }
// 1. Otkaži Lemon Squeezy subscription

if (
  user.lemonSqueezySubscriptionId &&
  ["active", "on_trial", "paused", "past_due", "unpaid"].includes(
    user.subscriptionStatus?.toLowerCase() ?? ""
  )
) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Billing is not configured correctly. Your account was not deleted.",
      },
      { status: 500 }
    );
  }

  const cancelResponse = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonSqueezySubscriptionId}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!cancelResponse.ok) {
    return NextResponse.json(
      {
        error:
          "Your subscription could not be cancelled, so your account was not deleted.",
      },
      { status: 502 }
    );
  }
}



await prisma.user.delete({
  where: {
    id: user.id,
  },
});
    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });

    const response = NextResponse.json({
      success: true,
      message:
        "Your subscription has been cancelled and your account has been deleted.",
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
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

    const reviewEmail =
      process.env.REVIEW_USER_EMAIL ?? "fr-josiah-review@orthodoxai.app";

    if (currentUser.email === reviewEmail) {
      return NextResponse.json(
        { error: "This review account cannot be deleted." },
        { status: 403 }
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

    const subscriptionStatus = user.subscriptionStatus?.toLowerCase() ?? "";

    const hasActiveSubscription =
      Boolean(user.lemonSqueezySubscriptionId) &&
      ACTIVE_SUBSCRIPTION_STATUSES.includes(subscriptionStatus);

    if (hasActiveSubscription) {
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

      const subscriptionResponse = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonSqueezySubscriptionId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            Authorization: `Bearer ${apiKey}`,
          },
          cache: "no-store",
        }
      );

      if (!subscriptionResponse.ok) {
        const errorBody = await subscriptionResponse.text();

        console.error("LEMON_SQUEEZY_PORTAL_ERROR:", {
          status: subscriptionResponse.status,
          body: errorBody,
          userId: user.id,
          subscriptionId: user.lemonSqueezySubscriptionId,
        });

        return NextResponse.json(
          {
            error:
              "Your subscription could not be opened. Your account was not deleted. Please try again or contact support.",
          },
          { status: 502 }
        );
      }

      const subscriptionData = await subscriptionResponse.json();

      const customerPortalUrl =
        subscriptionData?.data?.attributes?.urls?.customer_portal;

      if (!customerPortalUrl) {
        return NextResponse.json(
          {
            error:
              "The subscription management page is currently unavailable. Your account was not deleted.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Please cancel your Full Access subscription before deleting your account.",
          subscriptionActive: true,
          customerPortalUrl,
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

    response.cookies.set("orthodoxai_session", "", {
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
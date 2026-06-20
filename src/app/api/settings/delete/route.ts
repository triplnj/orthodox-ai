import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { stripe } from "@/lib/stripe";

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to delete your account." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const confirmation = String(body.confirmation ?? "").trim();

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "You must type DELETE to confirm account deletion." },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (dbUser.subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          dbUser.subscriptionId
        );

        const cancellableStatuses = [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
        ];

        if (cancellableStatuses.includes(subscription.status)) {
          await stripe.subscriptions.cancel(dbUser.subscriptionId);
        }
      } catch (stripeError) {
        console.error("STRIPE_CANCEL_BEFORE_DELETE_ERROR:", stripeError);

        return NextResponse.json(
          {
            error:
              "Could not cancel your Stripe subscription. Please cancel billing first from the billing portal, then delete your account.",
          },
          { status: 500 }
        );
      }
    }

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });

    await destroySession();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("SETTINGS_DELETE_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while deleting your account." },
      { status: 500 }
    );
  }
}
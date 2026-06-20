import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function updateUserFromSubscription(subscription: Stripe.Subscription) {
  const stripeCustomerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const subscriptionStatus = subscription.status;

  const isActive =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";

  await prisma.user.updateMany({
    where: {
      stripeCustomerId,
    },
    data: {
      plan: isActive ? "PRO" : "FREE",
      subscriptionStatus,
      subscriptionId,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.text();

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("STRIPE_WEBHOOK_SIGNATURE_ERROR:", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserFromSubscription(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.user.updateMany({
          where: {
            stripeCustomerId: subscription.customer as string,
          },
          data: {
            plan: "FREE",
            subscriptionStatus: subscription.status,
            subscriptionId: null,
          },
        });

        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const stripeCustomerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (userId && stripeCustomerId) {
          await prisma.user.update({
            where: {
              id: userId,
            },
            data: {
              stripeCustomerId,
              subscriptionId,
            },
          });
        }

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );

          await updateUserFromSubscription(subscription);
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("STRIPE_WEBHOOK_HANDLER_ERROR:", error);

    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }
}
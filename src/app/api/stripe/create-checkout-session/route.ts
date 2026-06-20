import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to upgrade to Pro." },
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
    stripeCustomerId: true,
  },
});

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    } 

    if (!dbUser.emailVerified) {
  return NextResponse.json(
    {
      error:
        "Please verify your email address before upgrading to OrthodoxAI Pro.",
      emailVerificationRequired: true,
    },
    { status: 403 }
  );
}

    let stripeCustomerId = dbUser.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        metadata: {
          userId: dbUser.id,
        },
      });

      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: {
          id: dbUser.id,
        },
        data: {
          stripeCustomerId,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        userId: dbUser.id,
      },
      subscription_data: {
        metadata: {
          userId: dbUser.id,
        },
      },
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("STRIPE_CHECKOUT_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the Checkout session." },
      { status: 500 }
    );
  }
}
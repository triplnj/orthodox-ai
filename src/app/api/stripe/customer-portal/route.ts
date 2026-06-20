import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to manage billing." },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

    if (!dbUser || !dbUser.stripeCustomerId) {
      return NextResponse.json(
        { error: "Stripe customer not found." },
        { status: 404 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("STRIPE_PORTAL_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while opening the billing portal." },
      { status: 500 }
    );
  }
}
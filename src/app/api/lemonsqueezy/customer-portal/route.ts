import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: currentUser.id,
      },
      select: {
        lemonSqueezySubscriptionId: true,
      },
    });

    if (!user?.lemonSqueezySubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription was found." },
        { status: 404 }
      );
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonSqueezySubscriptionId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("LEMON_SQUEEZY_PORTAL_ERROR:", data);

      return NextResponse.json(
        { error: "Could not open the subscription portal." },
        { status: 502 }
      );
    }

    const url = data?.data?.attributes?.urls?.customer_portal;

    if (!url) {
      return NextResponse.json(
        { error: "Billing portal URL was not returned." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("CUSTOMER_PORTAL_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while opening the billing portal." },
      { status: 500 }
    );
  }
}
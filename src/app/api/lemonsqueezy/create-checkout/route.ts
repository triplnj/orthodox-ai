import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
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

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !storeId || !variantId || !appUrl) {
    return NextResponse.json(
      { error: "Lemon Squeezy billing is not configured." },
      { status: 500 }
    );
  }

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
        attributes: {
          checkout_data: {
            email: dbUser.email,
            name: dbUser.name ?? undefined,
            custom: {
              userId: dbUser.id,
            },
          },
          product_options: {
            redirect_url: `${appUrl}/pro/success`,
          },
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Lemon Squeezy checkout error:", data);

    return NextResponse.json(
      { error: "Could not create Lemon Squeezy checkout." },
      { status: 500 }
    );
  }

  const checkoutUrl = data?.data?.attributes?.url;

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "Lemon Squeezy checkout URL missing." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkoutUrl });
}

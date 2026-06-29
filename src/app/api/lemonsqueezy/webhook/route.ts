import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function verifySignature({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

function getPlanFromStatus(status?: string) {
  if (!status) {
    return "FREE" as const;
  }

  return status === "active" || status === "on_trial"
    ? ("PRO" as const)
    : ("FREE" as const);
}

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Lemon Squeezy webhook secret missing." },
      { status: 500 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  const isValid = verifySignature({
    rawBody,
    signature,
    secret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  const eventName =
    payload?.meta?.event_name ?? req.headers.get("x-event-name") ?? "";

  const customData = payload?.meta?.custom_data ?? {};
  const userId = customData.userId;

  const data = payload?.data;
  const attributes = data?.attributes ?? {};

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId in Lemon Squeezy custom data." },
      { status: 400 }
    );
  }

  if (
    eventName === "subscription_created" ||
    eventName === "subscription_updated"
  ) {
    const subscriptionId = String(data.id);
    const status = attributes.status;
    const customerId = attributes.customer_id
      ? String(attributes.customer_id)
      : null;
    const orderId = attributes.order_id ? String(attributes.order_id) : null;
    const variantId = attributes.variant_id
      ? String(attributes.variant_id)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: getPlanFromStatus(status),
        subscriptionStatus: status ?? null,
        lemonSqueezyCustomerId: customerId,
        lemonSqueezySubscriptionId: subscriptionId,
        lemonSqueezyOrderId: orderId,
        lemonSqueezyVariantId: variantId,
      },
    });

    return NextResponse.json({ received: true });
  }

  if (
    eventName === "subscription_cancelled" ||
    eventName === "subscription_expired" ||
    eventName === "subscription_payment_failed"
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "FREE",
        subscriptionStatus: attributes.status ?? eventName,
        lemonSqueezySubscriptionId: data?.id ? String(data.id) : undefined,
      },
    });

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignored: eventName });
}
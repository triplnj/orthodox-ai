import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_TEST_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Test webhook not configured." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 256000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const supplied = request.headers.get("x-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!/^[a-f0-9]{64}$/i.test(supplied) || !timingSafeEqual(expected, Buffer.from(supplied, "hex"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  let payload: {
    meta?: { event_name?: string; custom_data?: { userId?: string; billingAttemptId?: string } };
    data?: { attributes?: { test_mode?: boolean }; id?: string };
  };
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  if (payload.data?.attributes?.test_mode !== true) {
    return NextResponse.json({ error: "Only test events are accepted." }, { status: 400 });
  }
  const event = payload.meta?.event_name ?? "";
  if (!event.startsWith("subscription_") && !event.startsWith("order_")) {
    return NextResponse.json({ received: true, ignored: event });
  }
  const attemptId = payload.meta?.custom_data?.billingAttemptId;
  const userId = payload.meta?.custom_data?.userId;
  if (!attemptId || !userId) return NextResponse.json({ received: true, unmatched: true });
  const attempt = await prisma.billingCheckoutAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId || attempt.provider !== "LEMONSQUEEZY_TEST") {
    return NextResponse.json({ error: "Test checkout ownership mismatch." }, { status: 409 });
  }
  const eventId = createHash("sha256").update(raw).digest("hex");
  await prisma.$transaction(async tx => {
    await tx.billingWebhookEvent.upsert({
      where: { provider_eventId: { provider: "LEMONSQUEEZY_TEST", eventId } },
      create: { provider: "LEMONSQUEEZY_TEST", eventId, eventType: event, payloadDigest: eventId,
        status: "PROCESSED", processedAt: new Date() },
      update: { status: "PROCESSED", processedAt: new Date() },
    });
    if (event === "subscription_created" || event === "order_created") {
      await tx.billingCheckoutAttempt.updateMany({
        where: { id: attemptId, userId, provider: "LEMONSQUEEZY_TEST", status: { in: ["CREATING", "OPEN", "UNKNOWN"] } },
        data: { status: "COMPLETED", checkoutUrl: null },
      });
    }
  });
  // Deliberately never update users.plan, subscription state or billing entitlements.
  return NextResponse.json({ received: true, mode: "TEST" });
}

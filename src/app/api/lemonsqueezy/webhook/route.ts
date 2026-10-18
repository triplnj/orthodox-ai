import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { webhook } from "@/lib/billing/service";
import { billingFailure } from "@/lib/billing/http";

export async function POST(req: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Lemon Squeezy webhook secret missing." }, { status: 503 });
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  const digest = createHmac("sha256", secret).update(rawBody).digest();
  if (!/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(digest, Buffer.from(signature, "hex"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const eventType = payload?.meta?.event_name;
  if (typeof eventType !== "string") return NextResponse.json({ error: "Missing event type." }, { status: 400 });
  if (!eventType.startsWith("subscription_")) return NextResponse.json({ received: true, ignored: eventType });
  const subscriptionId = payload?.data?.type === "subscriptions" ? payload.data.id : payload?.data?.attributes?.subscription_id;
  if (!subscriptionId) return NextResponse.json({ error: "Missing subscription reference." }, { status: 400 });
  try {
    await webhook({ provider: "LEMONSQUEEZY", eventId: createHash("sha256").update(rawBody).digest("hex"),
      eventType, subscriptionId: String(subscriptionId), rawBody,
      customerId: payload?.data?.attributes?.customer_id ? String(payload.data.attributes.customer_id) : undefined,
      userId: payload?.meta?.custom_data?.userId, attemptId: payload?.meta?.custom_data?.billingAttemptId });
    return NextResponse.json({ received: true });
  } catch (error) { return billingFailure(error); }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { makePaddleLiveBinding } from "@/lib/billing/paddle-live-binding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prepared Live checkout authorization, NOT yet wired into the public CTA.
 * Requires three independent gates and verified server-side account state.
 * It cannot be enabled by simply turning on PADDLE_LIVE_CHECKOUT_ENABLED.
 */
export async function POST(request: Request) {
 const headers = { "Cache-Control": "no-store" };
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_CHECKOUT_ENABLED !== "enabled" ||
     process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled") {
   return NextResponse.json({ error: "Not found." }, { status: 404, headers });
 }
 let sameOrigin = false;
 try {
   const target = new URL(request.url), source = new URL(request.headers.get("origin") ?? "");
   sameOrigin = target.protocol === "https:" && target.origin === source.origin;
 } catch { /* Missing or malformed origin. */ }
 if (!sameOrigin)
   return NextResponse.json({ error: "Forbidden." }, { status: 403, headers });
 const user = await getSessionUser();
 if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401, headers });
 if (!user.emailVerified || user.billingDeletionRequestedAt ||
     ["fr-josiah-review@orthodoxai.app", "clergy-review@orthodoxai.app"].includes(user.email.toLowerCase())) {
   return NextResponse.json({ error: "Account not eligible." }, { status: 403, headers });
 }
 const secret = process.env.PADDLE_LIVE_BINDING_SECRET;
 const priceId = process.env.PADDLE_LIVE_PRO_PRICE_ID;
 const productId = process.env.PADDLE_LIVE_PRO_PRODUCT_ID;
 if (!secret || secret.length < 32 || !/^pri_[a-z0-9]{26}$/.test(priceId ?? "") ||
     !/^pro_[a-z0-9]{26}$/.test(productId ?? "") ||
     !process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN?.startsWith("live_"))
   return NextResponse.json({ error: "Live checkout not configured." }, { status: 503, headers });

 try {
   // Block conflicting legacy checkout states and paid subscriptions.
   const rows = await prisma.billingSubscription.findMany({
     where: { userId: user.id }, select: { status: true, currentPeriodEndsAt: true },
   });
   const uncertain = await prisma.billingCheckoutAttempt.findFirst({
     where: { userId: user.id, status: { in: ["CREATING", "OPEN", "UNKNOWN", "PAID_OPEN"] } },
     select: { id: true },
   });
   if (uncertain || rows.some(r => !["canceled", "cancelled", "expired", "incomplete_expired"].includes(r.status)))
     return NextResponse.json({ error: "An existing subscription or checkout must be reconciled." },
       { status: 409, headers });
   // No public UI or payment request is created here. Checkout creation will
   // be connected only after the durable Paddle attempt ledger is implemented.
   return NextResponse.json({
     mode: "LIVE_CHECKOUT_AUTHORIZED_NOT_LAUNCHED",
     priceId,
     customData: makePaddleLiveBinding(user.id, secret),
     paymentEnabled: false,
   }, { headers });
 } catch {
   return NextResponse.json({ error: "Billing status unavailable." }, { status: 503, headers });
 }
}

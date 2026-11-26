import { randomUUID } from "node:crypto";
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
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled") {
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
 const adminIds = (process.env.BLOG_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim());
 if (adminIds.includes(user.id))
   return NextResponse.json({ error: "Administrator account cannot be charged." }, { status: 403, headers });
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
   // This transaction fences overlapping attempts, with an explicit expiry
   // requiring reconciliation before the same customer can try again.
   const attempt = await prisma.$transaction(async tx => {
     await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`paddle-live-checkout:${user.id}`},0))`;
     const actualUser = await tx.user.findUnique({
       where: { id: user.id },
       select: { emailVerified: true, billingDeletionRequestedAt: true,
         subscriptionId: true, lemonSqueezySubscriptionId: true },
     });
     if (!actualUser?.emailVerified || actualUser.billingDeletionRequestedAt)
       return null;
     const older = await tx.$queryRaw<Array<{ id: string }>>`
       SELECT "id" FROM "PaddleLiveCheckoutAttempt" WHERE "userId" = ${user.id}
       AND "status" IN ('OPEN','UNKNOWN') LIMIT 1`;
     if (older.length) return null;
     // Legacy pointers are unambiguous blockers even before inventory recovery.
     if (actualUser.subscriptionId || actualUser.lemonSqueezySubscriptionId)
       return null;
     const legacy = await tx.billingSubscription.findMany({
       where: { userId: user.id },
       select: { status: true, currentPeriodEndsAt: true },
     });
     const pending = await tx.billingCheckoutAttempt.findFirst({
       where: { userId: user.id,
         status: { in: ["CREATING","OPEN","UNKNOWN","PAID_OPEN"] } },
       select: { id: true },
     });
     if (pending || legacy.some(row =>
       !["canceled", "cancelled", "expired", "incomplete_expired"].includes(row.status) ||
       (row.currentPeriodEndsAt && row.currentPeriodEndsAt > new Date()))) return null;
     const live = await tx.$queryRaw<Array<{ subscriptionId: string }>>`
       SELECT "subscriptionId" FROM "PaddleLiveSubscription"
       WHERE "userId" = ${user.id} AND
       ("periodEndsAt" > CURRENT_TIMESTAMP OR "status" NOT IN ('canceled','expired'))
       LIMIT 1`;
     if (live.length) return null;
     const id = randomUUID();
     const expiresAt = new Date(Date.now()+30*60_000);
     await tx.$executeRaw`
       INSERT INTO "PaddleLiveCheckoutAttempt" ("id","userId","status","expiresAt")
       VALUES (${id},${user.id},'OPEN',${expiresAt})`;
     return { id, expiresAt };
   }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
   if (!attempt)
     return NextResponse.json({ error: "An active or unresolved billing attempt requires reconciliation before another purchase." },
       { status: 409, headers });
   return NextResponse.json({
     mode: "LIVE_CHECKOUT_READY",
     priceId,
     customData: makePaddleLiveBinding(user.id, secret,
       Math.floor(Date.now() / 1000), attempt.id),
     paymentEnabled: true,
     expiresAt: attempt.expiresAt.toISOString(),
   }, { headers });
 } catch {
   return NextResponse.json({ error: "Billing status unavailable." }, { status: 503, headers });
 }
}

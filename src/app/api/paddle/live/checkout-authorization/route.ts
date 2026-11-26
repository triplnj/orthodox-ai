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
     const older = await tx.$queryRaw<Array<{ id: string; providerTransactionId: string | null; expiresAt: Date; status: string }>>`
       SELECT "id","providerTransactionId","expiresAt","status" FROM "PaddleLiveCheckoutAttempt" WHERE "userId" = ${user.id}
       AND "status" IN ('OPEN','UNKNOWN') LIMIT 1`;
     if (older.length) {
       const prior = older[0];
       if (prior.status === "OPEN" && prior.providerTransactionId)
         return { id: prior.id, expiresAt: prior.expiresAt, transactionId: prior.providerTransactionId };
       return null;
     }
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
     return { id, expiresAt, transactionId: null as string | null };
   }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
   if (!attempt)
     return NextResponse.json({ error: "An active or unresolved billing attempt requires reconciliation before another purchase." },
       { status: 409, headers });
   const apiKey = process.env.PADDLE_LIVE_API_KEY;
   if (!apiKey?.startsWith("pdl_live_apikey_"))
     return NextResponse.json({ error: "Live Paddle API unavailable." }, { status: 503, headers });

   let transactionId = attempt.transactionId;
   if (transactionId) {
     // Reopen the exact existing transaction, never create another payment.
     const previous = await fetch(`https://api.paddle.com/transactions/${transactionId}`, {
       headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
       cache: "no-store", signal: AbortSignal.timeout(12000),
     });
     if (!previous.ok) throw Error("Cannot safely recover Paddle transaction.");
     const value: unknown = await previous.json();
     const transaction = value && typeof value === "object" && "data" in value ?
       (value as { data: Record<string, unknown> }).data : null;
     if (!transaction || transaction.id !== transactionId ||
         !["draft", "ready"].includes(String(transaction.status)) ||
         transaction.collection_mode !== "automatic")
       return NextResponse.json({ error: "Checkout already completed or requires billing reconciliation." },
         { status: 409, headers });
   } else {
     // Reserve the attempt before creating the external transaction. An unknown
     // response fails closed; operator reconciliation prevents duplicate charges.
     const customData = makePaddleLiveBinding(user.id, secret,
       Math.floor(Date.now() / 1000), attempt.id);
     const created = await fetch("https://api.paddle.com/transactions", {
       method: "POST",
       headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json",
         "Content-Type": "application/json" },
       body: JSON.stringify({
         collection_mode: "automatic",
         items: [{ price_id: priceId, quantity: 1 }],
         custom_data: customData,
       }),
       cache: "no-store", signal: AbortSignal.timeout(12000),
     });
     if (!created.ok) {
       await prisma.$executeRaw`
         UPDATE "PaddleLiveCheckoutAttempt" SET "status" = 'UNKNOWN'
         WHERE "id" = ${attempt.id} AND "userId" = ${user.id} AND "status" = 'OPEN'`;
       throw Error("Paddle transaction creation uncertain.");
     }
     const value: unknown = await created.json();
     const transaction = value && typeof value === "object" && "data" in value ?
       (value as { data: Record<string, unknown> }).data : null;
     if (!transaction || typeof transaction.id !== "string" ||
         !/^txn_[a-z0-9]{26}$/.test(transaction.id) ||
         !["draft","ready"].includes(String(transaction.status)) ||
         transaction.collection_mode !== "automatic")
       throw Error("Paddle transaction could not be verified.");
     transactionId = transaction.id;
     const updated = await prisma.$queryRaw<Array<{ id: string }>>`
       UPDATE "PaddleLiveCheckoutAttempt" SET "providerTransactionId" = ${transactionId}
       WHERE "id" = ${attempt.id} AND "userId" = ${user.id}
         AND "status" = 'OPEN' AND "providerTransactionId" IS NULL
       RETURNING "id"`;
     if (updated.length !== 1) throw Error("Paddle checkout state uncertain.");
   }
   return NextResponse.json({
     mode: "LIVE_CHECKOUT_READY", paymentEnabled: true,
     transactionId, expiresAt: attempt.expiresAt.toISOString(),
   }, { headers });
 } catch {
   return NextResponse.json({ error: "Billing status unavailable." }, { status: 503, headers });
 }
}

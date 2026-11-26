import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side Paddle portal link for the verified, logged-in Live owner. */
export async function POST(request: Request) {
 const headers = { "Cache-Control": "no-store" };
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_GRANT_ACCESS !== "enabled" ||
     process.env.PADDLE_LIVE_RECONCILIATION_READY !== "enabled")
   return NextResponse.json({ error: "Not found." }, { status: 404, headers });
 try {
   const origin = new URL(request.headers.get("origin") ?? "");
   const target = new URL(request.url);
   if (origin.origin !== target.origin || target.protocol !== "https:")
     return NextResponse.json({ error: "Forbidden." }, { status: 403, headers });
 } catch {
   return NextResponse.json({ error: "Forbidden." }, { status: 403, headers });
 }
 const user = await getCurrentUser();
 if (!user || user.billingProvider !== "PADDLE")
   return NextResponse.json({ error: "No verified Paddle subscription." }, { status: 404, headers });
 const key = process.env.PADDLE_LIVE_API_KEY;
 if (!key?.startsWith("pdl_live_apikey_"))
   return NextResponse.json({ error: "Billing portal not configured." }, { status: 503, headers });
 try {
   const rows = await prisma.$queryRaw<Array<{ subscriptionId: string; customerId: string }>>`
     SELECT "subscriptionId", "customerId" FROM "PaddleLiveSubscription"
     WHERE "userId" = ${user.id} AND "status" = 'active'
       AND "periodEndsAt" > CURRENT_TIMESTAMP AND "paidTransactionId" IS NOT NULL
     ORDER BY "periodEndsAt" DESC LIMIT 1`;
   const row = rows[0];
   if (!row) return NextResponse.json({ error: "No subscription found." }, { status: 404, headers });
   const response = await fetch(
     `https://api.paddle.com/customers/${row.customerId}/portal-sessions`,
     { method: "POST", headers: {
       Authorization: `Bearer ${key}`,
       Accept: "application/json", "Content-Type": "application/json",
     }, body: JSON.stringify({ subscription_ids: [row.subscriptionId] }),
       cache: "no-store", signal: AbortSignal.timeout(12000) },
   );
   if (!response.ok) throw Error("Paddle portal request failed");
   const json: unknown = await response.json();
   const result = json && typeof json === "object" && "data" in json ?
     (json as { data: { urls?: { general?: { overview?: unknown } } } }).data : null;
   const overview = result?.urls?.general?.overview;
   if (typeof overview !== "string") throw Error("Paddle portal URL missing");
   const url = new URL(overview);
   if (url.protocol !== "https:" || url.hostname !== "customer-portal.paddle.com")
     throw Error("Untrusted Paddle portal host");
   return NextResponse.json({ url: overview }, { headers });
 } catch {
   return NextResponse.json({ error: "Paddle portal temporarily unavailable." },
     { status: 503, headers });
 }
}

import { NextResponse } from "next/server";
import { verifyPaddleSignature } from "@/lib/billing/paddle-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 256_000;

/**
 * Live webhook endpoint; inert until separately enabled after database migration.
 * Raw-body HMAC first; minimal metadata stored after signature verification.
 * No subscription or user plan mutations.
 */
export async function POST(request: Request) {
 const noStore = { "Cache-Control": "no-store" };
 if (process.env.VERCEL_ENV !== "production" ||
     process.env.PADDLE_LIVE_WEBHOOK_ENABLED !== "enabled") {
   return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
 }
 const secret = process.env.PADDLE_LIVE_WEBHOOK_SECRET;
 if (!secret?.startsWith("pdl_ntfset_"))
   return NextResponse.json({ error: "Webhook not configured." }, { status: 503, headers: noStore });
 const declared = request.headers.get("content-length");
 if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
   return NextResponse.json({ error: "Payload too large." }, { status: 413, headers: noStore });
 let raw: string;
 try { raw = await request.text(); } catch {
   return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: noStore });
 }
 if (Buffer.byteLength(raw, "utf8") > MAX_BYTES)
   return NextResponse.json({ error: "Payload too large." }, { status: 413, headers: noStore });
 if (!verifyPaddleSignature(raw, request.headers.get("paddle-signature"),
       secret, Math.floor(Date.now() / 1000), 300)) {
   return NextResponse.json({ error: "Invalid signature." }, { status: 401, headers: noStore });
 }
 let event: unknown;
 try { event = JSON.parse(raw); } catch {
   return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers: noStore });
 }
 if (!event || typeof event !== "object" || Array.isArray(event))
   return NextResponse.json({ error: "Invalid envelope." }, { status: 400, headers: noStore });
 const e = event as Record<string, unknown>;
 if (typeof e.event_id !== "string" || !/^evt_[a-z0-9]{26}$/.test(e.event_id) ||
     typeof e.event_type !== "string" || !/^[a-z_]+\.[a-z_]+$/.test(e.event_type) ||
     !e.data || typeof e.data !== "object" || Array.isArray(e.data)) {
   return NextResponse.json({ error: "Invalid envelope." }, { status: 400, headers: noStore });
 }
 try {
   const { recordPaddleLiveEvent } = await import("@/lib/billing/paddle-live-event-store");
   const result = await recordPaddleLiveEvent(raw, e as {
     event_id: string; event_type: string; occurred_at?: unknown;
     data: Record<string, unknown>;
   });
   // Explicitly separate receipt from payment verification. This branch stays
   // unreachable while Live flags are disabled in Vercel.
   if (process.env.PADDLE_LIVE_GRANT_ACCESS === "enabled" &&
       process.env.PADDLE_LIVE_RECONCILIATION_READY === "enabled" &&
       ["transaction.completed", "subscription.activated",
        "subscription.updated", "subscription.resumed"].includes(e.event_type)) {
     const data = e.data as Record<string, unknown>;
     const subscriptionId = e.event_type.startsWith("subscription.") ?
       data.id : data.subscription_id;
     if (typeof subscriptionId === "string" &&
         /^sub_[a-z0-9]{26}$/.test(subscriptionId)) {
       const { retrieveVerifiedPaddleLivePayment } =
         await import("@/lib/billing/paddle-live-provider");
       const paid = await retrieveVerifiedPaddleLivePayment(subscriptionId);
       if (paid) {
         const { saveVerifiedPaddleLivePayment } =
           await import("@/lib/billing/paddle-live-subscription-store");
         await saveVerifiedPaddleLivePayment(paid);
       }
     }
   }
   return NextResponse.json({ received: true, mode: "LIVE_AUDIT_ONLY", duplicate: result === "duplicate" },
     { headers: noStore });
 } catch {
   // Missing migration / database errors are not acknowledged so Paddle can retry.
   return NextResponse.json({ error: "Live event recording unavailable." },
     { status: 503, headers: noStore });
 }
}

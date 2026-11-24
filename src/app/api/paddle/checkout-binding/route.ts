import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { PADDLE_SANDBOX_CATALOG } from "@/lib/billing/paddle-sandbox-catalog";
import { makePaddleCheckoutBinding } from "@/lib/billing/paddle-checkout-binding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stage 1: authenticate and bind an intended purchase; NO checkout is opened. */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const origin = request.headers.get("origin");
  let matchesOrigin = false;
  try {
    const source = new URL(origin ?? "");
    const target = new URL(request.url);
    matchesOrigin = source.origin === target.origin && source.protocol === "https:";
  } catch { /* Reject invalid origin headers. */ }
  if (!matchesOrigin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret?.startsWith("pdl_ntfset_") ||
      !process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.startsWith("test_")) {
    return NextResponse.json({ error: "Sandbox checkout binding is not configured." }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!user.emailVerified || user.billingDeletionRequestedAt) {
    return NextResponse.json({ error: "Verified account required." }, { status: 403 });
  }
  const customData = makePaddleCheckoutBinding(user.id, secret);
  return NextResponse.json({
    mode: "SANDBOX_BINDING_ONLY",
    priceId: PADDLE_SANDBOX_CATALOG.monthlyPriceId,
    customData,
    paymentEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } });
}

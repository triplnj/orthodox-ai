import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createPaddleLiveCheckout, paddleCheckoutFailure } from "@/lib/billing/paddle-checkout";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const canonical = process.env.NEXT_PUBLIC_APP_URL;
  const allowed = new Set([new URL(request.url).origin]);
  if (canonical) {
    try { allowed.add(new URL(canonical).origin); } catch { /* unavailable */ }
  }
  if (!origin || !allowed.has(origin)) {
    return NextResponse.json({ error: "Invalid checkout origin." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });
  try {
    const result = await createPaddleLiveCheckout(user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = paddleCheckoutFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

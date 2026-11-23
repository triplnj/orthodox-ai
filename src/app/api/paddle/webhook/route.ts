import { NextResponse } from "next/server";
import { verifyPaddleSignature } from "@/lib/billing/paddle-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256_000;
const EXPECTED_BRANCH = "feature/paddle-transition-phase1-20261120";

/**
 * Phase 1: sandbox-only signature validation.
 *
 * IMPORTANT: this endpoint deliberately DOES NOT persist or process events.
 * Successful 200 responses mean "signature verified and payload received",
 * NOT that a payment was fulfilled or a subscription was activated.
 * Never point live Paddle notifications at this endpoint.
 */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("pdl_ntfset_")) {
    return NextResponse.json({ error: "Sandbox webhook verification is not configured." },
      { status: 503 });
  }

  const sizeHeader = request.headers.get("content-length");
  if (sizeHeader && Number(sizeHeader) > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Unable to read request body." }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  if (!verifyPaddleSignature(raw, request.headers.get("paddle-signature"), secret,
    Math.floor(Date.now() / 1000), 30)) {
    return NextResponse.json({ error: "Invalid Paddle signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const event = payload as Record<string, unknown>;
  if (typeof event.event_type !== "string" ||
      !/^[a-z_]+\.[a-z_]+$/.test(event.event_type) ||
      typeof event.event_id !== "string" ||
      !/^evt_[a-zA-Z0-9]+$/.test(event.event_id) ||
      !event.data || typeof event.data !== "object" || Array.isArray(event.data)) {
    return NextResponse.json({ error: "Invalid event envelope." }, { status: 400 });
  }

  // Do not log signed request bodies, customer data or secrets.
  // Event is acknowledged for integration testing only; no subscription updates.
  return NextResponse.json({ received: true, verified: true, mode: "SANDBOX_VERIFY_ONLY" });
}

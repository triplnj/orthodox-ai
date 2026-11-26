import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { retrieveVerifiedPaddleSandboxAccess } from "@/lib/billing/paddle-provider-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QA_ID = "qa_patristic_20261109";
const QA_BRANCH = "br-red-waterfall-asdlxovu";
const FEATURE_BRANCH = "feature/paddle-transition-phase1-20261120";

/**
 * Create an ephemeral Paddle-hosted portal session solely for the signed-in
 * owner of a verified paid Sandbox subscription in the isolated QA database.
 * No stored portal token, no customer ID submitted by the browser.
 */
export async function POST(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== FEATURE_BRANCH ||
      process.env.PADDLE_SANDBOX_GRANT_ACCESS !== "enabled") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  }

  let allowedOrigin = false;
  try {
    const url = new URL(request.url);
    allowedOrigin = url.protocol === "https:" &&
      new URL(request.headers.get("origin") ?? "").origin === url.origin;
  } catch { /* Reject missing or malformed origin. */ }
  if (!allowedOrigin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: noStore });
  }

  const user = await getSessionUser();
  if (!user || user.id !== QA_ID || user.email !== "patristic-qa@example.test" ||
      !user.emailVerified || user.billingDeletionRequestedAt) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  }

  let step: "database" | "evidence" | "paddle_api" | "paddle_response" = "database";
  let paddleStatus: number | undefined;
  try {
    const rows = await prisma.$queryRaw<Array<{ subscriptionId: string; customerId: string }>>`
      SELECT a."subscriptionId", a."customerId"
      FROM "PaddleSandboxAccess" a
      WHERE a."userId" = ${user.id} AND a."status" = 'active'
        AND a."periodEndsAt" > CURRENT_TIMESTAMP
        AND EXISTS (SELECT 1 FROM "PaddleSandboxBranchGuard"
                    WHERE "id" = ${QA_BRANCH})
      ORDER BY a."verifiedAt" DESC LIMIT 2`;
    if (!rows.length) return NextResponse.json({ error: "No verified Sandbox subscription." },
      { status: 409, headers: noStore });

    for (const row of rows) {
      if (!/^sub_[a-z0-9]{26}$/.test(row.subscriptionId) ||
          !/^ctm_[a-z0-9]{26}$/.test(row.customerId)) continue;
      step = "evidence";
      const evidence = await retrieveVerifiedPaddleSandboxAccess(row.subscriptionId);
      if (!evidence || evidence.userId !== user.id || evidence.customerId !== row.customerId ||
          evidence.periodEndsAt <= new Date()) continue;

      const apiKey = process.env.PADDLE_API_KEY;
      if (!apiKey?.startsWith("pdl_sdbx_apikey_")) throw new Error("Missing Paddle credentials.");
      step = "paddle_api";
      const response = await fetch(
        `https://sandbox-api.paddle.com/customers/${row.customerId}/portal-sessions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscription_ids: [row.subscriptionId] }),
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok) {
        paddleStatus = response.status;
        throw new Error("Paddle portal session creation failed.");
      }
      step = "paddle_response";
      const result: unknown = await response.json();
      const data = result && typeof result === "object" && "data" in result
        ? (result as { data: unknown }).data : null;
      const urls = data && typeof data === "object" && "urls" in data
        ? (data as { urls: unknown }).urls : null;
      const general = urls && typeof urls === "object" && "general" in urls
        ? (urls as { general: unknown }).general : null;
      const overview = general && typeof general === "object" && "overview" in general
        ? (general as { overview: unknown }).overview : null;
      if (typeof overview !== "string") throw new Error("Paddle portal link missing.");
      const url = new URL(overview);
      if (url.protocol !== "https:" ||
          !["customer-portal.paddle.com", "sandbox-customer-portal.paddle.com"].includes(url.hostname)) {
        throw new Error("Unexpected Paddle portal host.");
      }
      return NextResponse.json({ url: overview }, { headers: noStore });
    }
    return NextResponse.json({ error: "Paddle access is no longer verified." },
      { status: 409, headers: noStore });
  } catch {
    const errorCode = step === "paddle_api" && paddleStatus === 403
      ? "PADDLE_PORTAL_PERMISSION_DENIED"
      : step === "paddle_api" && paddleStatus === 401
      ? "PADDLE_PORTAL_KEY_REJECTED"
      : step === "paddle_api" && paddleStatus === 404
      ? "PADDLE_PORTAL_CUSTOMER_NOT_FOUND"
      : step === "paddle_api" ? "PADDLE_PORTAL_API_FAILED"
      : step === "paddle_response" ? "PADDLE_PORTAL_RESPONSE_INVALID"
      : step === "evidence" ? "PADDLE_PORTAL_VERIFICATION_FAILED"
      : "PADDLE_PORTAL_DATABASE_FAILED";
    return NextResponse.json({ error: "Paddle Sandbox portal is temporarily unavailable.", errorCode },
      { status: 503, headers: noStore });
  }
}

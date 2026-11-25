import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QA_ACCOUNT_ID = "qa_patristic_20261109";
const QA_EMAIL = "patristic-qa@example.test";
const QA_SUBSCRIPTION_ID = "sub_01m89tngg4vchnreshtwygntcv";

/**
 * Read-only test endpoint: accessible only to the one authenticated QA account
 * on the Paddle Preview branch. Never returns any Paddle API body or secrets.
 */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user || user.id !== QA_ACCOUNT_ID || user.email !== QA_EMAIL ||
      !user.emailVerified || user.billingDeletionRequestedAt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const guard = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaddleSandboxBranchGuard"
      WHERE "id" = 'br-red-waterfall-asdlxovu' LIMIT 1`;
    if (guard.length !== 1) {
      return NextResponse.json({ error: "QA database mismatch." },
        { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const { retrieveVerifiedPaddleSandboxAccess } =
      await import("@/lib/billing/paddle-provider-evidence");
    const proof = await retrieveVerifiedPaddleSandboxAccess(QA_SUBSCRIPTION_ID);
    return NextResponse.json({
      environment: "sandbox",
      subscriptionSeen: true,
      paymentEvidenceVerified: Boolean(proof),
      ownershipMatchesQaAccount: proof?.userId === user.id,
      eligibleForQaPro: proof?.userId === user.id && proof.periodEndsAt > new Date(),
      grantAccessEnabled: process.env.PADDLE_SANDBOX_GRANT_ACCESS === "enabled",
      note: "Read-only Paddle API verification; no Pro entitlement was written.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      paymentEvidenceVerified: false,
      error: "Paddle Sandbox verification unavailable.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import "server-only";
import { verifyPaddleSandboxPaidAccess } from "./paddle-paid-evidence";
import type { VerifiedPaddleSandboxAccess } from "./paddle-paid-evidence";

/** Server-to-server provider evidence; never accept subscription JSON from clients. */
async function paddleGet(path: string): Promise<unknown> {
  const key = process.env.PADDLE_API_KEY;
  if (!key?.startsWith("pdl_sdbx_apikey_")) {
    throw new Error("Paddle Sandbox API credentials not configured.");
  }
  const response = await fetch(`https://sandbox-api.paddle.com${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Paddle Sandbox provider evidence unavailable.");
  return response.json();
}

export async function retrieveVerifiedPaddleSandboxAccess(
  subscriptionId: string,
): Promise<VerifiedPaddleSandboxAccess | null> {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120" ||
      !/^sub_[a-z0-9]{26}$/.test(subscriptionId)) {
    return null;
  }
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret?.startsWith("pdl_ntfset_")) return null;

  const [subResponse, transactionResponse] = await Promise.all([
    paddleGet(`/subscriptions/${subscriptionId}`),
    paddleGet(`/transactions?subscription_id=${subscriptionId}&per_page=50`),
  ]);
  const sub = subResponse && typeof subResponse === "object" && "data" in subResponse
    ? (subResponse as { data: unknown }).data : null;
  const txns = transactionResponse && typeof transactionResponse === "object" &&
    "data" in transactionResponse ? (transactionResponse as { data: unknown }).data : null;
  return verifyPaddleSandboxPaidAccess(sub, txns, secret);
}

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

  const subResponse = await paddleGet(`/subscriptions/${subscriptionId}`);
  const sub = subResponse && typeof subResponse === "object" && "data" in subResponse
    ? (subResponse as { data: unknown }).data : null;

  // Cursor pagination is mandatory: a subscription may have many renewals.
  // Never follow a provider-supplied URL; use only validated opaque ID cursors
  // with a locally constructed, fixed Sandbox API endpoint.
  const transactions: unknown[] = [];
  let after: string | null = null;
  let complete = false;
  for (let page = 0; page < 10; page++) {
    const qs = `subscription_id=${subscriptionId}&per_page=50` +
      (after ? `&after=${encodeURIComponent(after)}` : "");
    const response = await paddleGet(`/transactions?${qs}`);
    if (!response || typeof response !== "object" || !("data" in response) ||
        !Array.isArray((response as { data: unknown }).data)) return null;
    const batch = (response as { data: unknown[] }).data;
    transactions.push(...batch);
    const meta = "meta" in response ? (response as { meta: unknown }).meta : null;
    const pagination = meta && typeof meta === "object" && "pagination" in meta
      ? (meta as { pagination: unknown }).pagination : null;
    if (!pagination || typeof pagination !== "object" ||
        !("has_more" in pagination) ||
        typeof (pagination as { has_more: unknown }).has_more !== "boolean") return null;
    if (!(pagination as { has_more: boolean }).has_more) {
      complete = true;
      break;
    }
    const last = batch.at(-1);
    const nextCursor = last && typeof last === "object" && "id" in last
      ? (last as { id: unknown }).id : null;
    if (typeof nextCursor !== "string" || !/^txn_[a-z0-9]{26}$/.test(nextCursor) ||
        nextCursor === after) return null;
    after = nextCursor;
  }
  if (!complete) return null;
  return verifyPaddleSandboxPaidAccess(sub, transactions, secret);
}

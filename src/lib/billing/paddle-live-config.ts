/**
 * Production Paddle configuration preflight ONLY.
 *
 * This module deliberately does not enable checkout, webhooks, entitlement
 * updates, or any network requests. Existing providers stay in charge until
 * a separately reviewed production migration is approved.
 */
import { PADDLE_SANDBOX_CATALOG } from "./paddle-sandbox-catalog";

type Variables = Record<string, string | undefined>;
export type PaddleLivePreflight = {
  readyForImplementationReview: boolean;
  endpoint: "https://api.paddle.com";
  problems: string[];
};

const paddleId = (prefix: string, value: string | undefined) =>
  typeof value === "string" && new RegExp(`^${prefix}_[a-z0-9]{26}$`).test(value);

export function inspectPaddleLiveConfiguration(
  env: Variables,
): PaddleLivePreflight {
  const problems: string[] = [];
  const key = env.PADDLE_LIVE_API_KEY;
  const token = env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN;
  const secret = env.PADDLE_LIVE_WEBHOOK_SECRET;
  const price = env.PADDLE_LIVE_PRO_PRICE_ID;
  const product = env.PADDLE_LIVE_PRO_PRODUCT_ID;

  if (!key?.startsWith("pdl_live_apikey_"))
    problems.push("Live API credential is missing or not live.");
  if (!token?.startsWith("live_"))
    problems.push("Live client-side token is missing or not live.");
  if (!secret?.startsWith("pdl_ntfset_") || secret.length < 24)
    problems.push("Live webhook destination signing secret is missing.");
  if (!paddleId("pri", price) || price === PADDLE_SANDBOX_CATALOG.monthlyPriceId)
    problems.push("Unique live monthly price ID must be configured.");
  if (!paddleId("pro", product) || product === PADDLE_SANDBOX_CATALOG.productId)
    problems.push("Unique live product ID must be configured.");

  // A branch/configuration mistake must not accidentally opt in to live billing.
  if (env.PADDLE_LIVE_CHECKOUT_ENABLED === "enabled" ||
      env.PADDLE_LIVE_GRANT_ACCESS === "enabled")
    problems.push("Live billing flags must remain disabled during preparation.");
  if (env.PADDLE_ENVIRONMENT === "sandbox" ||
      env.PADDLE_API_KEY?.startsWith("pdl_sdbx_apikey_"))
    problems.push("Sandbox credentials cannot be used for the live integration.");

  return {
    readyForImplementationReview: problems.length === 0,
    endpoint: "https://api.paddle.com",
    problems,
  };
}

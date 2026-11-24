import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const previewBranch = "feature/paddle-transition-phase1-20261120";
function makeRoute(overrides = {}, user = { id: "user_123", emailVerified: new Date(), billingDeletionRequestedAt: null }) {
  const load = createLoader({
    "next/server": { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) } },
    "@/lib/session": { getSessionUser: async () => user },
  }, {
    VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: previewBranch,
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_sandbox_test_checkout",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_checkout_token",
    PADDLE_SANDBOX_STORE_EVENTS: "enabled",
    PADDLE_SANDBOX_CHECKOUT_ENABLED: "enabled",
    ...overrides,
  });
  return load("src/app/api/paddle/checkout-binding/route.ts");
}
const request = (origin = "https://preview.example") =>
  new Request("https://preview.example/api/paddle/checkout-binding", {
    method: "POST", headers: { origin },
  });

test("authenticated verified Preview account receives fixed Sandbox price and signed binding", async () => {
  const result = await makeRoute().POST(request());
  assert.equal(result.status, 200);
  assert.equal(result.body.paymentEnabled, true);
  assert.equal(result.body.mode, "SANDBOX_CHECKOUT_READY");
  assert.match(result.body.priceId, /^pri_[a-z0-9]{26}$/);
  assert.equal(result.body.customData.orthodoxai_user_id, "user_123");
  assert.match(result.body.customData.orthodoxai_signature, /^[a-f0-9]{64}$/);
});

test("production, wrong branch, and missing checkout opt-in all fail closed", async () => {
  assert.equal((await makeRoute({ VERCEL_ENV: "production" }).POST(request())).status, 404);
  assert.equal((await makeRoute({ VERCEL_GIT_COMMIT_REF: "main" }).POST(request())).status, 404);
  assert.equal((await makeRoute({ PADDLE_SANDBOX_CHECKOUT_ENABLED: "" }).POST(request())).status, 503);
  assert.equal((await makeRoute({ PADDLE_SANDBOX_STORE_EVENTS: "" }).POST(request())).status, 503);
});

test("anonymous, unverified, and pending-deletion accounts cannot open checkout", async () => {
  assert.equal((await makeRoute({}, null).POST(request())).status, 401);
  assert.equal((await makeRoute({}, { id: "user_123", emailVerified: null }).POST(request())).status, 403);
  assert.equal((await makeRoute({}, { id: "user_123", emailVerified: new Date(), billingDeletionRequestedAt: new Date() }).POST(request())).status, 403);
});

test("cross-origin or malformed origin cannot mint a binding", async () => {
  assert.equal((await makeRoute().POST(request("https://evil.example"))).status, 403);
  assert.equal((await makeRoute().POST(request("%%%"))).status, 403);
});

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const secret = "pdl_ntfset_test_route_example";
const preview = "feature/paddle-transition-phase1-20261120";
const event = JSON.stringify({
  event_id: "evt_01jaaaaaaaaaaaaaaaaaaaaaaa",
  event_type: "subscription.activated",
  data: { id: "sub_01", customer_id: "ctm_demo" },
});

function route(env = {}) {
  const load = createLoader({
    "next/server": {
      NextResponse: { json: (body, options = {}) => ({ status: options.status ?? 200, body }) },
    },
  }, {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: preview,
    PADDLE_WEBHOOK_SECRET: secret,
    ...env,
  });
  return load("src/app/api/paddle/webhook/route.ts");
}

function request(body = event, { sign = true, timestamp = Math.floor(Date.now() / 1000), ...opts } = {}) {
  const headers = { "content-type": "application/json" };
  if (sign) headers["paddle-signature"] = `ts=${timestamp};h1=${createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex")}`;
  return new Request("https://preview.example/api/paddle/webhook", {
    method: "POST", headers, body, ...opts,
  });
}

test("Paddle webhook verifier rejects all production and other branch requests", async () => {
  assert.equal((await route({ VERCEL_ENV: "production" }).POST(request())).status, 404);
  assert.equal((await route({ VERCEL_GIT_COMMIT_REF: "main" }).POST(request())).status, 404);
});

test("Paddle webhook verifier is unavailable without a destination secret", async () => {
  assert.equal((await route({ PADDLE_WEBHOOK_SECRET: "" }).POST(request())).status, 503);
});

test("Paddle webhook verifier rejects unsigned and tampered requests", async () => {
  assert.equal((await route().POST(request(event, { sign: false }))).status, 401);
  const altered = event.replace("subscription.activated", "subscription.canceled");
  const forged = request(event);
  const tampered = new Request(forged.url, { method: "POST", headers: forged.headers, body: altered });
  assert.equal((await route().POST(tampered)).status, 401);
});

test("Paddle webhook verifier rejects stale signatures", async () => {
  assert.equal((await route().POST(request(event, { timestamp: Math.floor(Date.now() / 1000) - 60 }))).status, 401);
});

test("Paddle webhook verifier returns verify-only success without data mutation", async () => {
  const res = await route().POST(request());
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { received: true, verified: true, mode: "SANDBOX_VERIFY_ONLY" });
});

test("Paddle webhook verifier rejects a signed malformed envelope", async () => {
  const res = await route().POST(request(JSON.stringify({ event_type: "subscription.activated" })));
  assert.equal(res.status, 400);
});


test("Paddle simulated webhook event IDs are accepted when HMAC is valid", async () => {
  const sample = JSON.stringify({ event_id: "ntfsimevt_01jaaaaaaaaaaaaaaaaaaaaaaa", event_type: "subscription.activated", data: { id: "sub_test" } });
  const res = await route().POST(request(sample));
  assert.equal(res.status, 200);
  assert.equal(res.body.mode, "SANDBOX_VERIFY_ONLY");
});

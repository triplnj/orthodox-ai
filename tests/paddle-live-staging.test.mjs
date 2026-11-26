import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const secret = "pdl_ntfset_live_test_destination_secret";
const good = {
  event_id: "evt_" + "a".repeat(26),
  event_type: "subscription.updated",
  data: { id: "sub_" + "b".repeat(26) },
};
const body = JSON.stringify(good);
const response = {
  NextResponse: { json: (body, options = {}) =>
    ({ status: options.status ?? 200, body }) },
};
function loadLive(env = {}) {
  const load = createLoader({
    "next/server": response,
  }, {
    VERCEL_ENV: "production",
    PADDLE_LIVE_WEBHOOK_SECRET: secret,
    PADDLE_LIVE_WEBHOOK_ENABLED: "disabled",
    ...env,
  });
  return load("src/app/api/paddle/live/webhook/route.ts");
}
const request = (payload = body, signed = true) => {
  const ts = Math.floor(Date.now() / 1000);
  return new Request("https://www.orthodoxai.app/api/paddle/webhook", {
    method: "POST",
    headers: signed ? {
      "paddle-signature": `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${payload}`).digest("hex")}`,
    } : {},
    body: payload,
  });
};

test("production Paddle Live webhook stays inaccessible with only seven configured environment variables", async () => {
  const route = loadLive();
  assert.equal((await route.POST(request())).status, 404);
});

test("Paddle Live webhook cannot run in Preview even if manually enabled", async () => {
  const route = loadLive({ VERCEL_ENV: "preview", PADDLE_LIVE_WEBHOOK_ENABLED: "enabled" });
  assert.equal((await route.POST(request())).status, 404);
});

test("Live webhook rejects unsigned or malformed authenticated content", async () => {
  const route = loadLive({ PADDLE_LIVE_WEBHOOK_ENABLED: "enabled" });
  assert.equal((await route.POST(request(body, false))).status, 401);
  assert.equal((await route.POST(request("{", true))).status, 400);
});

test("Live checkout authorization requires independent future reconciliation gate", async () => {
  let sessionCalled = false;
  const load = createLoader({
    "next/server": response,
    "@/lib/session": { getSessionUser: async () => { sessionCalled = true; return null; } },
    "@/lib/prisma": { prisma: {} },
    "@/lib/billing/paddle-live-binding": { makePaddleLiveBinding: () => ({}) },
  }, {
    VERCEL_ENV: "production",
    PADDLE_LIVE_CHECKOUT_ENABLED: "disabled",
    PADDLE_LIVE_GRANT_ACCESS: "disabled",
  });
  const route = load("src/app/api/paddle/live/checkout-authorization/route.ts");
  const resp = await route.POST(new Request(
    "https://www.orthodoxai.app/api/paddle/live/checkout-authorization",
    { method: "POST", headers: { origin: "https://www.orthodoxai.app" } },
  ));
  assert.equal(resp.status, 404);
  assert.equal(sessionCalled, false);
});

test("Live checkout binding is isolated from sandbox and rejects expired proof", () => {
  const load = createLoader();
  const { makePaddleLiveBinding, verifyPaddleLiveBinding } =
    load("src/lib/billing/paddle-live-binding.ts");
  const signingSecret = "a".repeat(40);
  const t = 1800000000;
  const token = makePaddleLiveBinding("qa_test", signingSecret, t);
  assert.equal(verifyPaddleLiveBinding(token, signingSecret, t + 10)?.userId, "qa_test");
  assert.equal(verifyPaddleLiveBinding(token, signingSecret, t + 2000), null);
  assert.equal(verifyPaddleLiveBinding(token, "b".repeat(40), t + 10), null);
  assert.equal(verifyPaddleLiveBinding({ ...token,
    orthodoxai_binding_version: "1" }, signingSecret, t + 10), null);
});

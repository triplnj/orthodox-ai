import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader({ "server-only": {} });
const { verifyPaddleWebhookSignature: verify } = load("src/lib/billing/paddle-signature.ts");
const body = '{"event_id":"evt_123","event_type":"subscription.created"}';
const secret = "pdl_ntfset_test_secret";
const now = 1_800_000_000;
function signature(ts = now, payload = body) {
  return `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${payload}`).digest("hex")}`;
}
test("valid Paddle signed raw body is accepted", () => {
  assert.equal(verify(body, signature(), secret, now), true);
});
test("invalid signatures and tampering fail closed", () => {
  assert.equal(verify(body + " ", signature(), secret, now), false);
  assert.equal(verify(body, signature(), "wrong", now), false);
  assert.equal(verify(body, null, secret, now), false);
  assert.equal(verify(body, "ts=12;h1=oops", secret, now), false);
  assert.equal(verify(body, signature() + ";h1=" + "0".repeat(64), secret, now), false);
});
test("expired and future signatures are rejected", () => {
  assert.equal(verify(body, signature(now - 301), secret, now), false);
  assert.equal(verify(body, signature(now + 301), secret, now), false);
  assert.equal(verify(body, signature(now - 300), secret, now), true);
});
test("oversized payloads are rejected", () => {
  assert.equal(verify("x".repeat(1024 * 1024 + 1), signature(), secret, now), false);
});

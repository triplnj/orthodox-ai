import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const { verifyPaddleSignature, PADDLE_PHASE_ONE_MODE } = createLoader()("src/lib/billing/paddle-webhook.ts");
const secret = "pdl_ntfset_test_example";
const ts = 1_800_000_000;
const body = '{"event_type":"subscription.activated","data":{"id":"sub_example"}}';
const sign = (message, t = ts, key = secret) =>
  `ts=${t};h1=${createHmac("sha256", key).update(`${t}:${message}`).digest("hex")}`;

test("Paddle integration remains disabled during transition phase one", () => {
  assert.equal(PADDLE_PHASE_ONE_MODE, "DISABLED");
});

test("valid timestamped raw-body signature is accepted", () => {
  assert.equal(verifyPaddleSignature(body, sign(body), secret, ts), true);
});

test("tampering with body or secret fails closed", () => {
  assert.equal(verifyPaddleSignature(body + " ", sign(body), secret, ts), false);
  assert.equal(verifyPaddleSignature(body, sign(body), "different", ts), false);
});

test("missing, malformed, repeated, or stale signatures fail closed", () => {
  assert.equal(verifyPaddleSignature(body, null, secret, ts), false);
  assert.equal(verifyPaddleSignature(body, "ts=not-a-date;h1=deadbeef", secret, ts), false);
  assert.equal(verifyPaddleSignature(body, sign(body) + ";ts=1800000000", secret, ts), false);
  assert.equal(verifyPaddleSignature(body, sign(body, ts - 301), secret, ts), false);
  assert.equal(verifyPaddleSignature(body, sign(body, ts + 301), secret, ts), false);
});

test("max body size guard", () => {
  assert.equal(verifyPaddleSignature("x".repeat(256001), sign(body), secret, ts), false);
});

test("the supplied sandbox catalog IDs are valid and isolated from production", () => {
  const { PADDLE_SANDBOX_CATALOG, assertPaddleSandboxCatalog } =
    createLoader()("src/lib/billing/paddle-sandbox-catalog.ts");
  assert.match(PADDLE_SANDBOX_CATALOG.productId, /^pro_[a-z0-9]{26}$/);
  assert.match(PADDLE_SANDBOX_CATALOG.monthlyPriceId, /^pri_[a-z0-9]{26}$/);
  assert.doesNotThrow(() => assertPaddleSandboxCatalog(
    PADDLE_SANDBOX_CATALOG.productId, PADDLE_SANDBOX_CATALOG.monthlyPriceId, "sandbox"));
  assert.throws(() => assertPaddleSandboxCatalog(
    PADDLE_SANDBOX_CATALOG.productId, PADDLE_SANDBOX_CATALOG.monthlyPriceId, "production"));
});

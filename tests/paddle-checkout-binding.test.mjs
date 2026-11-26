import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const { makePaddleCheckoutBinding, verifyPaddleCheckoutBinding } =
  createLoader()("src/lib/billing/paddle-checkout-binding.ts");
const secret = "pdl_ntfset_sandbox_test_secret";

test("signed Paddle checkout binding links to exactly the authenticated user", () => {
  const signed = makePaddleCheckoutBinding("user_123", secret, 1800000000);
  assert.deepEqual(verifyPaddleCheckoutBinding(signed, secret, 1800000001), { userId: "user_123" });
  assert.notEqual(signed.orthodoxai_nonce, makePaddleCheckoutBinding("user_123", secret, 1800000000).orthodoxai_nonce);
});

test("client-side user ID substitution cannot reassign the purchase", () => {
  const signed = makePaddleCheckoutBinding("user_123", secret, 1800000000);
  assert.equal(verifyPaddleCheckoutBinding({ ...signed, orthodoxai_user_id: "user_999" }, secret, 1800000001), null);
  assert.equal(verifyPaddleCheckoutBinding({ ...signed, orthodoxai_signature: "a".repeat(64) }, secret, 1800000001), null);
  assert.equal(verifyPaddleCheckoutBinding(signed, "pdl_ntfset_wrong_key", 1800000001), null);
});

test("stale and future-dated checkout bindings are rejected", () => {
  const signed = makePaddleCheckoutBinding("user_123", secret, 1800000000);
  assert.equal(verifyPaddleCheckoutBinding(signed, secret, 1800001801), null);
  assert.equal(verifyPaddleCheckoutBinding(signed, secret, 1799999969), null);
});

test("unsigned or malformed binding payloads fail closed", () => {
  assert.equal(verifyPaddleCheckoutBinding({}, secret), null);
  assert.equal(verifyPaddleCheckoutBinding(null, secret), null);
  assert.throws(() => makePaddleCheckoutBinding("wrong user", secret));
  assert.throws(() => makePaddleCheckoutBinding("user_123", "test_public_token"));
});

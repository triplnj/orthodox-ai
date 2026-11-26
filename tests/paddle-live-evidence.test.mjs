import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";
const load = createLoader();
const { makePaddleLiveBinding } = load("src/lib/billing/paddle-live-binding.ts");
const { verifyPaddleLivePaidAccess: verify } = load("src/lib/billing/paddle-live-evidence.ts");
const secret = "a".repeat(48);
const first = "2026-11-25T17:04:46Z", renew = "2026-12-25T17:04:46Z";
const binding = makePaddleLiveBinding("qa_live_user", secret, Date.parse(first) / 1000);
const productId = "pro_" + "a".repeat(26), priceId = "pri_" + "b".repeat(26);
const subscriptionId = "sub_" + "c".repeat(26), customerId = "ctm_" + "d".repeat(26);
const tx = (id, created_at, changes = {}) => ({
  id: "txn_" + id.repeat(26), status: "completed", subscription_id: subscriptionId,
  customer_id: customerId, collection_mode: "automatic", currency_code: "USD",
  created_at, custom_data: binding, details: { totals: { total: "799" } },
  ...changes,
});
const original = tx("e", first), renewal = tx("f", renew);
const sub = {
  id: subscriptionId, customer_id: customerId, status: "active",
  custom_data: binding, billing_cycle: { interval: "month", frequency: 1 },
  current_billing_period: { starts_at: renew, ends_at: "2027-01-25T17:04:46Z" },
  scheduled_change: { action: "cancel", effective_at: "2027-01-25T17:04:46Z" },
  items: [{ quantity: 1, status: "active", price: { id: priceId, product_id: productId } }],
};
const config = { productId, priceId, bindingSecret: secret };
const today = new Date("2026-12-26T12:00:00Z");
test("Live renewal accepts verified initial owner and paid new billing cycle", () => {
  const proof = verify(sub, [original, renewal], config, today);
  assert.equal(proof?.userId, "qa_live_user");
  assert.equal(proof?.paidTransactionId, renewal.id);
  assert.equal(proof?.periodEndsAt.toISOString(), "2027-01-25T17:04:46.000Z");
  assert.equal(proof?.cancelAtPeriodEnd, true);
});
test("Live renewal denies old-only payment, failed payment, zero amount, or wrong price", () => {
  assert.equal(verify(sub, [original], config, today), null);
  assert.equal(verify(sub, [original, tx("f", renew, { status: "past_due" })], config, today), null);
  assert.equal(verify(sub, [original, tx("f", renew, { details: { totals: { total: "0" } } })], config, today), null);
  assert.equal(verify(sub, [original, renewal], { ...config, priceId: "pri_" + "x".repeat(26) }, today), null);
});
test("Live renewal denies forged identity, missing initial ownership, unpaid statuses and expiry", () => {
  assert.equal(verify(sub, [renewal], config, today), null);
  assert.equal(verify(sub, [tx("e", first, { custom_data: { ...binding, orthodoxai_signature: "0".repeat(64) } }), renewal], config, today), null);
  assert.equal(verify({ ...sub, status: "past_due" }, [original, renewal], config, today), null);
  assert.equal(verify(sub, [original, renewal], config, new Date("2027-01-25T17:04:46Z")), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { makePaddleCheckoutBinding } = load("src/lib/billing/paddle-checkout-binding.ts");
const { verifyPaddleSandboxPaidAccess: verify } = load("src/lib/billing/paddle-paid-evidence.ts");
const { PADDLE_SANDBOX_CATALOG: catalog } = load("src/lib/billing/paddle-sandbox-catalog.ts");

const secret = "pdl_ntfset_renewal_test_secret";
const id = (prefix, c) => prefix + "_" + c.repeat(26);
const sid = id("sub", "s"), cid = id("ctm", "c");
const firstAt = "2026-11-25T17:04:46Z", renewAt = "2026-12-25T17:04:46Z";
const binding = makePaddleCheckoutBinding("qa_patristic_test", secret, Math.floor(Date.parse(firstAt) / 1000));
const original = {
  id: id("txn", "a"), status: "completed", subscription_id: sid, customer_id: cid,
  currency_code: "USD", collection_mode: "automatic", created_at: firstAt,
  custom_data: binding, details: { totals: { total: "799" } },
};
const renewal = {
  ...original, id: id("txn", "b"), origin: "subscription_recurring",
  created_at: renewAt,
};
const subscription = {
  id: sid, status: "active", customer_id: cid, custom_data: binding,
  current_billing_period: {
    starts_at: renewAt, ends_at: "2027-01-25T17:04:46Z",
  },
  billing_cycle: { interval: "month", frequency: 1 },
  items: [{ status: "active", quantity: 1,
    price: { id: catalog.monthlyPriceId, product_id: catalog.productId },
  }],
};
const now = new Date("2026-12-26T12:00:00Z");
const verifyAt = (txns, sub = subscription) => verify(sub, txns, secret, now);

test("successful paid renewal uses original signed owner evidence and fresh completed payment", () => {
  const result = verifyAt([renewal, original]);
  assert.equal(result?.userId, "qa_patristic_test");
  assert.equal(result?.paidTransactionId, renewal.id);
  assert.equal(result?.periodEndsAt.toISOString(), "2027-01-25T17:04:46.000Z");
});

test("one old payment alone must not authorize new cycle", () => {
  assert.equal(verifyAt([original]), null);
});

test("renewal payment failure and past_due subscription fail closed", () => {
  for (const status of ["past_due", "billed", "canceled", "draft"]) {
    assert.equal(verifyAt([{ ...renewal, status }, original]), null);
  }
  assert.equal(verifyAt([renewal, original], { ...subscription, status: "past_due" }), null);
});

test("zero value method updates, other subscriptions and customers cannot authorize new cycle", () => {
  for (const overrides of [
    { details: { totals: { total: "0" } } },
    { subscription_id: id("sub", "x") },
    { customer_id: id("ctm", "x") },
    { custom_data: { ...binding, orthodoxai_user_id: "other" } },
    { created_at: firstAt },
  ]) assert.equal(verifyAt([{ ...renewal, ...overrides }, original]), null);
});

test("unbound copied renewals and forged original signatures do not establish account ownership", () => {
  assert.equal(verifyAt([{ ...renewal, custom_data: null }, original]), null);
  assert.equal(verifyAt([renewal, { ...original, custom_data: { ...binding,
    orthodoxai_signature: "0".repeat(64) } }]), null);
  assert.equal(verifyAt([renewal]), null);
});

test("new cycle cannot be granted before its start or after it ends", () => {
  assert.equal(verify(subscription, [original, renewal], secret,
    new Date("2026-12-24T12:00:00Z")), null);
  assert.equal(verify(subscription, [original, renewal], secret,
    new Date("2027-01-25T17:04:46Z")), null);
});

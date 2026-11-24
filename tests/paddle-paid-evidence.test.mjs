import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { makePaddleCheckoutBinding } = load("src/lib/billing/paddle-checkout-binding.ts");
const { verifyPaddleSandboxPaidAccess } = load("src/lib/billing/paddle-paid-evidence.ts");
const { PADDLE_SANDBOX_CATALOG } = load("src/lib/billing/paddle-sandbox-catalog.ts");

const secret = "pdl_ntfset_test_payment_evidence_secret";
const signedAt = Math.floor(Date.parse("2026-11-24T10:00:00Z") / 1000);
const now = new Date("2026-11-24T10:05:00Z");
const subId = "sub_01jaaaaaaaaaaaaaaaaaaaaaaa";
const ctmId = "ctm_01jaaaaaaaaaaaaaaaaaaaaaaa";
const txnId = "txn_01jaaaaaaaaaaaaaaaaaaaaaaa";

function fixture() {
  const custom_data = makePaddleCheckoutBinding("user_123", secret, signedAt);
  return {
    sub: {
      id: subId, status: "active", customer_id: ctmId, custom_data,
      current_billing_period: {
        starts_at: "2026-11-24T10:01:00Z", ends_at: "2026-12-24T10:01:00Z",
      },
      billing_cycle: { interval: "month", frequency: 1 },
      items: [{
        status: "active", quantity: 1,
        price: {
          id: PADDLE_SANDBOX_CATALOG.monthlyPriceId,
          product_id: PADDLE_SANDBOX_CATALOG.productId,
        },
      }],
    },
    transaction: {
      id: txnId, status: "completed", subscription_id: subId,
      customer_id: ctmId, currency_code: "USD", collection_mode: "automatic",
      created_at: "2026-11-24T10:01:00Z", custom_data,
      details: { totals: { total: "799" } },
    },
  };
}

test("confirmed matching paid Paddle Sandbox subscription produces bounded evidence", () => {
  const { sub, transaction } = fixture();
  const result = verifyPaddleSandboxPaidAccess(sub, [transaction], secret, now);
  assert.equal(result?.userId, "user_123");
  assert.equal(result?.subscriptionId, subId);
  assert.equal(result?.paidTransactionId, txnId);
  assert.equal(result?.periodEndsAt.toISOString(), "2026-12-24T10:01:00.000Z");
});

test("a webhook simulation payload alone cannot grant access", () => {
  const { sub } = fixture();
  assert.equal(verifyPaddleSandboxPaidAccess(sub, [], secret, now), null);
});

test("unpaid, zero-dollar, manual, stale, or mismatched transactions fail closed", () => {
  const { sub, transaction } = fixture();
  const mutations = [
    { status: "paid" }, { status: "billed" },
    { details: { totals: { total: "0" } } },
    { collection_mode: "manual" }, { subscription_id: "sub_" + "b".repeat(26) },
    { customer_id: "ctm_" + "b".repeat(26) },
    { currency_code: "EUR" },
    { custom_data: { ...transaction.custom_data, orthodoxai_user_id: "other" } },
    { created_at: "2026-11-24T11:01:00Z" },
  ];
  for (const changed of mutations)
    assert.equal(verifyPaddleSandboxPaidAccess(sub, [{ ...transaction, ...changed }], secret, now), null);
});

test("incorrect plan, paused, expired, and ownership mismatch fail closed", () => {
  const { sub, transaction } = fixture();
  const variants = [
    { ...sub, status: "paused" },
    { ...sub, items: [{ ...sub.items[0], price: { ...sub.items[0].price, id: "pri_" + "a".repeat(26) } }] },
    { ...sub, items: [{ ...sub.items[0], quantity: 2 }] },
    { ...sub, custom_data: { ...sub.custom_data, orthodoxai_user_id: "other" } },
    { ...sub, current_billing_period: { ...sub.current_billing_period, ends_at: "2026-11-23T10:01:00Z" } },
  ];
  for (const variant of variants)
    assert.equal(verifyPaddleSandboxPaidAccess(variant, [transaction], secret, now), null);
});

test("wrong secret never verifies ownership", () => {
  const { sub, transaction } = fixture();
  assert.equal(verifyPaddleSandboxPaidAccess(sub, [transaction], "pdl_ntfset_wrong", now), null);
});

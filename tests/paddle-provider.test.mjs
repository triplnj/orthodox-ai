import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const id = {
  subscription: "sub_" + "a".repeat(26),
  customer: "ctm_" + "b".repeat(26),
  price: "pri_" + "c".repeat(26),
  product: "pro_" + "d".repeat(26),
  transaction: "txn_" + "e".repeat(26),
};
function loadProvider({ paid = true, status = "active", product = id.product, wrongOwner = false, refunded = false } = {}) {
  const calls = [];
  const subscription = { id: id.subscription, customer_id: id.customer,
    status, updated_at: "2026-11-26T14:00:00Z",
    current_billing_period: { ends_at: "2026-12-26T14:00:00Z" },
    items: [{ price: { id: id.price, product_id: product }, quantity: 1 }] };
  const transaction = { id: id.transaction, subscription_id: id.subscription,
    customer_id: wrongOwner ? "ctm_" + "f".repeat(26) : id.customer,
    status: paid ? "completed" : "past_due",
    items: [{ price: { id: id.price }, quantity: 1 }],
    details: { totals: { grand_total: paid ? "799" : "0", currency_code: "USD" } } };
  const loader = createLoader({
    "server-only": {},
    "./providers": { BillingError: class BillingError extends Error { constructor(message, status = 409) { super(message); this.status = status; } } },
  }, {
    PADDLE_LIVE_API_KEY: "pdl_live_mock", PADDLE_LIVE_PRO_PRICE_ID: id.price,
    PADDLE_LIVE_PRO_PRODUCT_ID: id.product,
  });
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("/adjustments?")) return new Response(JSON.stringify({
      data: refunded ? [{ transaction_id: id.transaction, subscription_id: id.subscription, action: "refund", type: "full", status: "approved" }] : [],
      meta: { pagination: { has_more: false, next: null } },
    }), { status: 200 });
    if (String(url).includes("/transactions?")) return new Response(JSON.stringify({
      data: [transaction], meta: { pagination: { has_more: false, next: null } },
    }), { status: 200 });
    if (String(url).endsWith("/" + id.subscription)) return new Response(JSON.stringify({ data: subscription }), { status: 200 });
    throw new Error("Unexpected API call: " + url);
  };
  return { load: () => loader("src/lib/billing/paddle-provider.ts"), calls, restore: () => { globalThis.fetch = previous; } };
}
test("Paddle Pro requires a completed, positive, correctly owned transaction", async () => {
  const h = loadProvider();
  try {
    const result = await h.load().paddleRetrieve(id.subscription);
    assert.equal(result.provider, "PADDLE");
    assert.equal(result.paidVerified, true);
    assert.equal(result.status, "active");
  } finally { h.restore(); }
});
test("Paddle payment failure cannot verify Pro entitlement", async () => {
  const h = loadProvider({ paid: false });
  try { assert.equal((await h.load().paddleRetrieve(id.subscription)).paidVerified, false); }
  finally { h.restore(); }
});
test("Paddle product mismatch fails closed", async () => {
  const h = loadProvider({ product: "pro_" + "z".repeat(26) });
  try { await assert.rejects(h.load().paddleRetrieve(id.subscription), /mismatch/); }
  finally { h.restore(); }
});
test("Paddle transaction from another customer fails closed", async () => {
  const h = loadProvider({ wrongOwner: true });
  try { await assert.rejects(h.load().paddleRetrieve(id.subscription), /ownership mismatch/); }
  finally { h.restore(); }
});

test("approved full Paddle refund revokes verified payment evidence", async () => {
  const h = loadProvider({ refunded: true });
  try { assert.equal((await h.load().paddleRetrieve(id.subscription)).paidVerified, false); }
  finally { h.restore(); }
});

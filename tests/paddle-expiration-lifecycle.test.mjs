import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { makePaddleCheckoutBinding } = load("src/lib/billing/paddle-checkout-binding.ts");
const { verifyPaddleSandboxPaidAccess } = load("src/lib/billing/paddle-paid-evidence.ts");
const { PADDLE_SANDBOX_CATALOG } = load("src/lib/billing/paddle-sandbox-catalog.ts");
const { isProUser } = load("src/lib/subscription.ts");

const secret = "pdl_ntfset_sandbox_expiration_fixture";
const start = "2026-11-25T17:04:46.853Z";
const end = "2026-12-25T17:04:46.853Z";
const issuedAt = Math.floor(Date.parse(start) / 1000);
const binding = makePaddleCheckoutBinding("qa_user_expiry_test", secret, issuedAt);
const sid = "sub_" + "a".repeat(26);
const cid = "ctm_" + "b".repeat(26);
const transaction = {
  id: "txn_" + "c".repeat(26),
  status: "completed",
  subscription_id: sid,
  customer_id: cid,
  currency_code: "USD",
  collection_mode: "automatic",
  created_at: start,
  custom_data: binding,
  details: { totals: { total: "799" } },
};
const subscription = {
  id: sid,
  status: "active",
  customer_id: cid,
  custom_data: binding,
  scheduled_change: { action: "cancel", effective_at: end },
  current_billing_period: { starts_at: start, ends_at: end },
  billing_cycle: { interval: "month", frequency: 1 },
  items: [{
    quantity: 1, status: "active",
    price: {
      id: PADDLE_SANDBOX_CATALOG.monthlyPriceId,
      product_id: PADDLE_SANDBOX_CATALOG.productId,
    },
  }],
};
const proofAt = (time, sub = subscription) =>
  verifyPaddleSandboxPaidAccess(sub, [transaction], secret, new Date(time));
const proUser = (until) => ({
  id: "qa_user_expiry_test", email: "test@example.test", plan: "PRO",
  subscriptionStatus: "active", billingAccessUntil: until,
});

test("Paddle scheduled cancellation retains paid access one millisecond before expiry", () => {
  const before = new Date(Date.parse(end) - 1);
  const verified = proofAt(before.toISOString());
  assert.equal(verified?.userId, "qa_user_expiry_test");
  assert.equal(verified?.periodEndsAt.toISOString(), end);
});

test("Paddle scheduled cancellation stops access at exact paid-period boundary", () => {
  assert.equal(proofAt(end), null);
  assert.equal(proofAt(new Date(Date.parse(end) + 1000).toISOString()), null);
  assert.equal(proofAt("2027-01-25T17:04:46.853Z"), null);
});

test("provider cancellation and pause cannot create renewed access", () => {
  for (const status of ["canceled", "paused", "past_due"]) {
    assert.equal(proofAt("2026-12-01T12:00:00Z", {
      ...subscription, status,
    }), null);
  }
});

test("isProUser denies expired overlay even when plan/status are stale PRO/active", () => {
  assert.equal(isProUser(proUser(new Date(Date.now() - 1))), false);
  assert.equal(isProUser(proUser(null)), false);
  assert.equal(isProUser(proUser(new Date(Date.now() + 86400000))), true);
});

test("returning Free account keeps lifetime chat usage, including chats made while Pro", async () => {
  const allHistoricalUses = 14;
  const calls = [];
  const tx = {
    usageLog: { count: async ({ where }) => {
      calls.push(where);
      return allHistoricalUses;
    } },
    aiReservation: { count: async () => 0 },
  };
  const clock = createLoader({
    "server-only": {},
    "@/lib/diagnostics": { diagnostic: () => {} },
    "@/lib/prisma": { prisma: { $transaction: async () => { throw Error("no DB"); } } },
    "@/lib/ai/previewQaAccess": { isIsolatedPreviewQaChatUser: () => false },
  }, { AI_QUOTA_TIMEZONE: "UTC", NODE_ENV: "test" });
  const { quotaSnapshot } = clock("src/lib/ai/operationLimits.ts");
  const user = { id: "qa_user_expiry_test", email: "test@example.test", plan: "FREE" };
  const now = new Date("2026-12-26T12:00:00Z");
  const snapshot = await quotaSnapshot(user.id, "chat", user, tx, now);
  assert.equal(snapshot.limit, 3);
  assert.equal(snapshot.used, allHistoricalUses);
  assert.equal(snapshot.remaining, 0);
  assert.equal(snapshot.timezone, "lifetime");
  assert.equal(snapshot.resetsAt, "9999-12-31T23:59:59.999Z");
  assert.equal(calls.length, 1);
  assert.equal("createdAt" in calls[0], false, "Free lifetime quota must not reset by date");
});

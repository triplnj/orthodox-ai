import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mock, test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Live provider calls forbidden"); });
const DAY = 86400000;
function user(overrides = {}) { return { id: "u", email: "u@example.com", name: "U", emailVerified: new Date(),
  plan: "FREE", subscriptionStatus: null, subscriptionId: null, stripeCustomerId: null,
  lemonSqueezyCustomerId: null, lemonSqueezySubscriptionId: null,
  billingAccessUntil: null, billingGraceUntil: null, billingRecoveryLog: null, billingDeletionRequestedAt: null, ...overrides }; }
function sub(provider = "STRIPE", overrides = {}) { return { provider, providerSubscriptionId: `${provider}-sub`,
  providerCustomerId: `${provider}-customer`, providerProductId: "product", status: "active",
  trialEndsAt: null, currentPeriodEndsAt: new Date(Date.now() + 30 * DAY), cancelAtPeriodEnd: false,
  providerUpdatedAt: null, paidVerified: true, ...overrides }; }
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "provider_providerSubscriptionId" || key === "provider_eventId") return matches(row, value);
    if (value && typeof value === "object" && value.in) return value.in.includes(row[key]);
    return row[key] === value;
  });
}
function harness({ initialUser = user(), subscriptions = [] } = {}) {
  const state = { users: [initialUser, user({ id: "admin", email: "admin@example.com" })], subscriptions: [], events: [], attempts: [] };
  const calls = [];
  let sequence = 0, queue = Promise.resolve();
  const remote = new Map(subscriptions.map(s => [`${s.provider}:${s.providerSubscriptionId}`, structuredClone(s)]));
  const options = { outage: false, providerOutage: null, cancelFailure: null, cancellationIneffective: false, debt: false,
    unknownCheckout: false, checkoutClosed: false, failReceipt: false, signedIn: true };
  function model(key) {
    return {
      findUnique: async ({ where }) => structuredClone(state[key].find(row => matches(row, where)) ?? null),
      findFirst: async ({ where }) => structuredClone(state[key].find(row => matches(row, where)) ?? null),
      findMany: async ({ where = {}, take } = {}) => structuredClone(state[key].filter(row => matches(row, where)).slice(0, take)),
      create: async ({ data }) => {
        const row = { id: `row-${++sequence}`, status: key === "attempts" ? "CREATING" : "unverified_legacy", lastVerifiedAt: null,
          paidVerified: false, recoveryLog: null, providerUpdatedAt: null, ...data };
        state[key].push(row); return structuredClone(row);
      },
      update: async ({ where, data }) => {
        const row = state[key].find(row => matches(row, where));
        if (!row) throw new Error("Record not found");
        Object.assign(row, data); return structuredClone(row);
      },
      updateMany: async ({ where, data }) => { const rows = state[key].filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
      delete: async ({ where }) => {
        const row = state[key].find(row => matches(row, where));
        // Mimic FK SET NULL, rather than deleting billing records.
        state.users = state.users.filter(candidate => candidate.id !== row.id);
        for (const name of ["subscriptions", "attempts"]) for (const record of state[name]) if (record.userId === row.id) record.userId = null;
        calls.push("user.delete"); return row;
      },
      upsert: async ({ where, create, update }) => {
        if (key === "events" && options.failReceipt) throw new Error("Receipt write failure");
        const row = state[key].find(row => matches(row, where));
        if (row) { Object.assign(row, update); return structuredClone(row); }
        return model(key).create({ data: create });
      },
    };
  }
  const prisma = { user: model("users"), billingSubscription: model("subscriptions"),
    billingWebhookEvent: model("events"), billingCheckoutAttempt: model("attempts"), $executeRaw: async () => { calls.push("lock"); } };
  prisma.$transaction = async work => {
    const previous = queue; let release;
    queue = new Promise(resolve => { release = resolve; }); await previous;
    const snapshot = structuredClone(state);
    try { return await work(prisma); } catch (error) { Object.assign(state, snapshot); throw error; } finally { release(); }
  };
  const providers = {
    retrieve: async (provider, id) => { calls.push(`retrieve:${id}`); if (options.outage || options.providerOutage === provider) throw new actual.BillingError("Provider unavailable", 503);
      const s = remote.get(`${provider}:${id}`); if (!s) throw new Error("Unknown subscription"); return structuredClone(s); },
    inventory: async (provider, customer) => { if (options.outage || options.providerOutage === provider) throw new actual.BillingError("Provider unavailable", 503);
      return structuredClone([...remote.values()].filter(s => s.provider === provider && s.providerCustomerId === customer)); },
    terminal: s => s.provider === "STRIPE" ? ["canceled", "incomplete_expired"].includes(s.status) : ["cancelled", "expired"].includes(s.status),
    cancel: async s => { calls.push(`cancel:${s.provider}`); if (options.cancelFailure === s.provider) throw new Error("Cancellation failed");
      if (!options.cancellationIneffective) remote.get(`${s.provider}:${s.providerSubscriptionId}`).status = s.provider === "STRIPE" ? "canceled" : "cancelled"; },
    assertNoDebt: async () => { if (options.debt) throw new Error("Pending payment"); },
    createCheckout: async (provider, _user, id) => { calls.push(`checkout:${provider}`); if (options.unknownCheckout) throw new Error("Unknown result");
      return { id, url: "https://checkout.example/hosted", expiresAt: new Date(Date.now() + DAY), customerId: provider === "STRIPE" ? "STRIPE-customer" : null }; },
    checkoutClosed: async () => options.checkoutClosed,
    portal: async provider => `https://portal.example/${provider}`,
  };
  // Override only I/O functions; use the real BillingError and terminal rules.
  const actual = createLoader({ "server-only": {} })("src/lib/billing/providers.ts");
  const loader = createLoader({ "server-only": {}, "@/lib/prisma": { prisma }, "./providers": { ...actual, ...providers },
    "@/lib/auth": { getCurrentUser: async () => options.signedIn ? state.users.find(u => u.id === "u") : null },
  }, { BILLING_ADMIN_USER_IDS: "admin" });
  return { state, calls, remote, options, load: loader, service: loader("src/lib/billing/service.ts"), prisma };
}
function notice(s, overrides = {}) { return { provider: s.provider, eventId: "event-1", eventType: "subscription_updated",
  subscriptionId: s.providerSubscriptionId, customerId: s.providerCustomerId, rawBody: "signed-body", ...overrides }; }
function associated(s, overrides = {}) { return user(s.provider === "STRIPE" ? { stripeCustomerId: s.providerCustomerId, subscriptionId: s.providerSubscriptionId, ...overrides }
  : { lemonSqueezyCustomerId: s.providerCustomerId, lemonSqueezySubscriptionId: s.providerSubscriptionId, ...overrides }); }

for (const provider of ["STRIPE", "LEMONSQUEEZY"]) {
  test(`${provider}: verified activation and renewal retain PRO and extend period`, async () => {
    const s = sub(provider), h = harness({ initialUser: associated(s), subscriptions: [s] });
    await h.service.webhook(notice(s));
    assert.equal(h.state.users[0].plan, "PRO");
    assert.equal(h.state.subscriptions.length, 1);
    h.remote.get(`${provider}:${s.providerSubscriptionId}`).currentPeriodEndsAt = new Date(Date.now() + 60 * DAY);
    await h.service.webhook(notice(s, { eventId: "renewal", rawBody: "renewal" }));
    assert.ok(h.state.users[0].billingAccessUntil > new Date(Date.now() + 59 * DAY));
  });
  test(`${provider}: valid trial grants PRO without paid grace`, async () => {
    const s = sub(provider, { status: provider === "STRIPE" ? "trialing" : "on_trial", paidVerified: false, trialEndsAt: new Date(Date.now() + DAY) });
    const h = harness({ initialUser: associated(s), subscriptions: [s] }); await h.service.webhook(notice(s));
    assert.equal(h.state.users[0].plan, "PRO"); assert.equal(h.state.users[0].billingGraceUntil, null);
    assert.equal(+h.state.users[0].billingAccessUntil, +s.trialEndsAt);
  });
  test(`${provider}: scheduled cancellation retains paid-through access without grace`, async () => {
    const s = sub(provider, { cancelAtPeriodEnd: true }); const h = harness({ initialUser: associated(s), subscriptions: [s] });
    await h.service.webhook(notice(s)); assert.equal(h.state.users[0].plan, "PRO"); assert.equal(h.state.users[0].billingGraceUntil, null);
  });
  test(`${provider}: duplicate webhook applies once`, async () => {
    const s = sub(provider), h = harness({ initialUser: associated(s), subscriptions: [s] });
    await Promise.all([h.service.webhook(notice(s)), h.service.webhook(notice(s))]);
    assert.equal(h.state.events.length, 1); assert.equal(h.calls.filter(c => c.startsWith("retrieve:")).length, 1);
  });
  test(`${provider}: delayed activation cannot revive current cancellation`, async () => {
    const s = sub(provider, { status: provider === "STRIPE" ? "canceled" : "expired", paidVerified: false });
    const h = harness({ initialUser: associated(s, { plan: "PRO", subscriptionStatus: "active" }), subscriptions: [s] });
    await h.service.webhook(notice(s, { eventType: "subscription_created", occurredAt: new Date(0) }));
    assert.equal(h.state.users[0].plan, "FREE");
  });
  test(`${provider}: provider failure rolls back receipt and entitlements`, async () => {
    const s = sub(provider), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.options.outage = true;
    await assert.rejects(h.service.webhook(notice(s))); assert.equal(h.state.events.length, 0); assert.equal(h.state.users[0].plan, "FREE");
  });
  test(`${provider}: deletion cancels and verifies before deleting, preserving ledger`, async () => {
    const s = sub(provider), h = harness({ initialUser: associated(s), subscriptions: [s] });
    await h.service.deleteAccount("u"); assert.ok(!h.state.users.some(u => u.id === "u"));
    assert.equal(h.state.subscriptions[0].userId, null); assert.ok(h.state.subscriptions[0].retainedUntil > new Date());
    assert.ok(h.calls.indexOf(`cancel:${provider}`) < h.calls.indexOf("user.delete"));
  });
  test(`${provider}: failed cancellation retains account and deletion fence`, async () => {
    const s = sub(provider), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.options.cancelFailure = provider;
    await assert.rejects(h.service.deleteAccount("u")); assert.ok(h.state.users[0].billingDeletionRequestedAt); assert.ok(!h.calls.includes("user.delete"));
  });
}
test("an old Stripe cancellation cannot revoke Lemon PRO or replace current Stripe pointer", async () => {
  const old = sub("STRIPE", { providerSubscriptionId: "old", status: "canceled" }), current = sub("LEMONSQUEEZY");
  const h = harness({ initialUser: associated(old, { subscriptionId: "new", lemonSqueezyCustomerId: current.providerCustomerId }), subscriptions: [old, current] });
  await h.service.webhook(notice(current)); await h.service.webhook(notice(old));
  assert.equal(h.state.users[0].plan, "PRO"); assert.equal(h.state.users[0].subscriptionId, "new");
});
test("equal event timestamps still reconcile current provider state", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] });
  await h.service.webhook(notice(s, { occurredAt: new Date(0) }));
  h.remote.get(`STRIPE:${s.providerSubscriptionId}`).status = "canceled";
  await h.service.webhook(notice(s, { eventId: "same-time", rawBody: "other", occurredAt: new Date(0) }));
  assert.equal(h.state.users[0].plan, "FREE");
});
test("receipt write failure rolls back subscription and PRO grant; retry succeeds", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.options.failReceipt = true;
  await assert.rejects(h.service.webhook(notice(s))); assert.equal(h.state.subscriptions.length, 0); assert.equal(h.state.users[0].plan, "FREE");
  h.options.failReceipt = false; await h.service.webhook(notice(s)); assert.equal(h.state.users[0].plan, "PRO");
});
test("reused event ID with another body is rejected", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] }); await h.service.webhook(notice(s));
  await assert.rejects(h.service.webhook(notice(s, { rawBody: "tampered" })), /collision/);
});
test("metadata alone cannot grant PRO to an unassociated user", async () => {
  const s = sub(), h = harness({ subscriptions: [s] }); await assert.rejects(h.service.webhook(notice(s, { userId: "u" })), /association/);
  assert.equal(h.state.users[0].plan, "FREE");
});
test("mismatched signed user metadata cannot change another account", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] });
  await assert.rejects(h.service.webhook(notice(s, { userId: "admin" })), /owner mismatch/);
});
test("deleted subscription tombstones cannot attach to a new user", async () => {
  const s = sub(), h = harness({ subscriptions: [s] }); h.state.subscriptions.push({ ...s, userId: null });
  await h.service.webhook(notice(s, { userId: "u" })); assert.equal(h.state.users[0].plan, "FREE");
});
test("concurrent cross-provider checkout creates only one hosted checkout", async () => {
  const h = harness(); const results = await Promise.allSettled([h.service.checkout("u", "STRIPE"), h.service.checkout("u", "LEMONSQUEEZY")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(h.calls.filter(c => c.startsWith("checkout:")).length, 1);
});
test("valid open checkout is reused", async () => {
  const h = harness(); assert.deepEqual(await h.service.checkout("u", "LEMONSQUEEZY"), await h.service.checkout("u", "LEMONSQUEEZY"));
  assert.equal(h.calls.filter(c => c.startsWith("checkout:")).length, 1);
});
test("unknown checkout remains fenced despite expired local timer", async () => {
  const h = harness(); h.options.unknownCheckout = true; await assert.rejects(h.service.checkout("u", "LEMONSQUEEZY"));
  h.state.attempts[0].expiresAt = new Date(0); assert.equal(h.state.attempts[0].status, "UNKNOWN");
  await assert.rejects(h.service.checkout("u", "STRIPE"), /pending/); await assert.rejects(h.service.deleteAccount("u"), /Pending checkout/);
});
for (const provider of ["STRIPE", "LEMONSQUEEZY"]) test(`${provider}: existing trial blocks another provider checkout`, async () => {
  const s = sub(provider, { status: provider === "STRIPE" ? "trialing" : "on_trial" });
  const h = harness({ initialUser: associated(s), subscriptions: [s] }); await assert.rejects(h.service.checkout("u", provider === "STRIPE" ? "LEMONSQUEEZY" : "STRIPE"), /existing subscription/);
});
test("unverified email cannot start checkout", async () => {
  const h = harness({ initialUser: user({ emailVerified: null }) }); await assert.rejects(h.service.checkout("u", "STRIPE"), /verify/);
});
test("deletion fence blocks checkout even after a process interruption", async () => {
  const h = harness({ initialUser: user({ billingDeletionRequestedAt: new Date(0) }) }); await assert.rejects(h.service.checkout("u", "STRIPE"), /deletion/);
});
test("both review account identities are protected case insensitively", async () => {
  for (const email of ["FR-JOSIAH-REVIEW@orthodoxai.app", "clergy-review@orthodoxai.app"]) {
    const h = harness({ initialUser: user({ email }) }); await assert.rejects(h.service.deleteAccount("u"), /review account/); assert.equal(h.state.users.length, 2);
  }
});
test("partial dual-provider cancellation never deletes local account", async () => {
  const stripe = sub(), lemon = sub("LEMONSQUEEZY"), h = harness({ initialUser: associated(stripe, { lemonSqueezyCustomerId: lemon.providerCustomerId }), subscriptions: [stripe, lemon] });
  h.options.cancelFailure = "LEMONSQUEEZY"; await assert.rejects(h.service.deleteAccount("u")); assert.ok(!h.calls.includes("user.delete"));
  assert.equal(h.remote.get(`STRIPE:${stripe.providerSubscriptionId}`).status, "canceled"); assert.ok(h.state.users[0].billingDeletionRequestedAt);
});
test("successful cancellation response without terminal re-fetch retains account", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.options.cancellationIneffective = true;
  await assert.rejects(h.service.deleteAccount("u"), /not yet verified/); assert.ok(!h.calls.includes("user.delete"));
});
test("pending invoices prevent deletion after successful cancellation", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.options.debt = true;
  await assert.rejects(h.service.deleteAccount("u")); assert.ok(!h.calls.includes("user.delete"));
});
test("unknown subscription status never permits another purchase", async () => {
  const s = sub("STRIPE", { status: "new-provider-status" }), h = harness({ initialUser: associated(s), subscriptions: [s] });
  await assert.rejects(h.service.checkout("u", "LEMONSQUEEZY"), /existing subscription/);
});
test("bounded outage grace preserves only previously verified paid PRO", async () => {
  const end = new Date(Date.now() - DAY), grace = new Date(+end + 3 * DAY);
  const initial = user({ plan: "PRO", subscriptionStatus: "active", billingAccessUntil: end, billingGraceUntil: grace, stripeCustomerId: "STRIPE-customer" });
  const h = harness({ initialUser: initial }); h.options.outage = true;
  h.state.subscriptions.push({ ...sub("STRIPE", { currentPeriodEndsAt: end }), userId: "u", lastVerifiedAt: new Date(+end - DAY) });
  const result = await h.service.refreshAccess(initial); assert.equal(+result.billingAccessUntil, +grace);
  assert.equal(+h.state.users[0].billingAccessUntil, +end, "grace is not saved as another verification");
});
test("outage grace cannot restart or survive its 72-hour deadline", async () => {
  const initial = user({ plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(Date.now() - 4 * DAY), billingGraceUntil: new Date(Date.now() - DAY), stripeCustomerId: "STRIPE-customer" });
  const h = harness({ initialUser: initial }); h.options.outage = true;
  const result = await h.service.refreshAccess(initial); assert.ok(result.billingAccessUntil < new Date());
});
test("trial expiry and FREE users never receive outage grace", async () => {
  for (const plan of ["PRO", "FREE"]) {
    const initial = user({ plan, subscriptionStatus: "active", billingAccessUntil: new Date(0), billingGraceUntil: null, stripeCustomerId: "STRIPE-customer" });
    const h = harness({ initialUser: initial }); h.options.outage = true; assert.equal(+(await h.service.refreshAccess(initial)).billingAccessUntil, 0);
  }
});
test("healthy provider cancellation revokes access instead of using outage grace", async () => {
  const s = sub("STRIPE", { status: "canceled" }), initial = associated(s, { plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(0), billingGraceUntil: new Date(Date.now() + DAY) });
  const h = harness({ initialUser: initial, subscriptions: [s] }); const refreshed = await h.service.refreshAccess(initial); assert.equal(refreshed.plan, "FREE");
});
test("unverified legacy rows cannot override known provider cancellation", async () => {
  const s = sub("STRIPE", { status: "canceled" }), h = harness({ initialUser: associated(s, { plan: "PRO", subscriptionStatus: "active" }), subscriptions: [s] });
  h.state.subscriptions.push({ provider: "LEMONSQUEEZY", providerSubscriptionId: "legacy", userId: "u", lastVerifiedAt: null });
  await h.service.webhook(notice(s)); assert.equal(h.state.users[0].plan, "FREE");
});
test("recovery requires explicit verified administrator provisioning", async () => {
  const h = harness(); await assert.rejects(h.service.recover("u", "u", "Investigated interrupted deletion"), /administrator/);
  h.state.users[1].emailVerified = null; await assert.rejects(h.service.recover("u", "admin", "Investigated interrupted deletion"), /administrator/);
});
test("confirmed closed checkout recovery clears fence and records evidence action", async () => {
  const h = harness({ initialUser: user({ billingDeletionRequestedAt: new Date() }) });
  h.state.attempts.push({ id: "attempt", userId: "u", provider: "STRIPE", status: "UNKNOWN", providerCheckoutId: "hosted", recoveryLog: null });
  h.options.checkoutClosed = true; await h.service.recover("u", "admin", "Provider confirmed checkout closure");
  assert.equal(h.state.attempts[0].status, "RECONCILED"); assert.equal(h.state.users[0].billingDeletionRequestedAt, null);
  assert.equal(h.state.attempts[0].recoveryLog[0].actor, "admin"); assert.equal(h.state.users[0].billingRecoveryLog.length, 2);
});
test("uncertain checkout without provider ID cannot be cleared; failed recovery remains audited", async () => {
  const h = harness({ initialUser: user({ billingDeletionRequestedAt: new Date(0) }) });
  h.state.attempts.push({ id: "attempt", userId: "u", provider: "LEMONSQUEEZY", status: "UNKNOWN", expiresAt: new Date(0), providerCheckoutId: null });
  await assert.rejects(h.service.recover("u", "admin", "Investigated unknown provider outcome"), /unproven/);
  assert.ok(h.state.users[0].billingDeletionRequestedAt); assert.equal(h.state.attempts[0].status, "UNKNOWN");
  assert.equal(h.state.users[0].billingRecoveryLog[0].action, "RECOVERY_REQUESTED");
});
test("deletion without billing needs no provider initialization", async () => { const h = harness(); await h.service.deleteAccount("u"); assert.deepEqual(h.calls.filter(c => c.startsWith("retrieve:") || c.startsWith("cancel:")), []); });
for (const path of ["account/delete", "settings/delete"]) {
  test(`${path}: unauthorized requests cannot delete`, async () => {
    const h = harness(); h.options.signedIn = false; const req = new Request("https://example.test", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: '{"confirmation":"DELETE"}' });
    assert.equal((await h.load(`src/app/api/${path}/route.ts`).DELETE(req)).status, 401); assert.equal(h.calls.length, 0);
  });
  test(`${path}: successful deletion uses the authoritative service and clears cookie`, async () => {
    const h = harness(); const req = new Request("https://example.test", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: '{"confirmation":"DELETE"}' });
    const response = await h.load(`src/app/api/${path}/route.ts`).DELETE(req); assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie"), /orthodoxai_session=;/);
  });
}
test("settings deletion retains confirmation requirement", async () => {
  const h = harness(); const response = await h.load("src/app/api/settings/delete/route.ts").DELETE(new Request("https://example.test", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: '{}' }));
  assert.equal(response.status, 400); assert.equal(h.calls.length, 0);
});
test("current Lemon portal URL supports legacy Stripe subscribers", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] });
  const response = await h.load("src/app/api/lemonsqueezy/customer-portal/route.ts").POST();
  assert.deepEqual(await response.json(), { url: "https://portal.example/STRIPE" });
});
test("dual-provider portal gives an explicit conflict", async () => {
  const a = sub(), b = sub("LEMONSQUEEZY"), h = harness({ initialUser: associated(a, { lemonSqueezyCustomerId: b.providerCustomerId }), subscriptions: [a, b] });
  await assert.rejects(h.service.billingPortal("u"), /Multiple billing providers/);
});
test("Lemon webhook rejects invalid signature and malformed signed JSON without mutations", async () => {
  const h = harness(); h.load.environment.LEMONSQUEEZY_WEBHOOK_SECRET = "mock-signing-secret";
  const route = h.load("src/app/api/lemonsqueezy/webhook/route.ts");
  for (const signed of [false, true]) {
    const body = "not-json", signature = signed ? createHmac("sha256", "mock-signing-secret").update(body).digest("hex") : "bad";
    const response = await route.POST(new Request("https://example.test", { method: "POST", body, headers: { "x-signature": signature } }));
    assert.equal(response.status, 400);
  }
  assert.equal(h.state.events.length, 0);
});

function providerHarness() {
  const calls = [];
  const stripeSubscription = { id: "sub", customer: "customer", status: "active", livemode: true,
    latest_invoice: "invoice", trial_end: null, cancel_at_period_end: false,
    items: { data: [{ price: { id: "price" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } };
  const stripe = {
    customers: { create: async (...args) => { calls.push(["customer", ...args]); return { id: "new-customer" }; } },
    checkout: { sessions: { create: async (...args) => { calls.push(["checkout", ...args]); return { id: "checkout", url: "https://stripe.test", expires_at: 2000000000 }; },
      retrieve: async () => ({ status: "open" }) } },
    subscriptions: { retrieve: async () => stripeSubscription, list: async () => ({ data: [{ id: "sub" }], has_more: false }) },
    invoices: { retrieve: async () => ({ status: "paid", amount_paid: 1200 }), list: async () => ({ data: [] }) },
  };
  const load = createLoader({ "server-only": {}, "@/lib/stripe": { getStripe: () => stripe } }, {
    STRIPE_PRO_PRICE_ID: "price", NEXT_PUBLIC_APP_URL: "https://app.test", LEMONSQUEEZY_API_KEY: "mock-only",
    LEMONSQUEEZY_STORE_ID: "store", LEMONSQUEEZY_PRO_VARIANT_ID: "variant", NODE_ENV: "production",
  });
  return { adapter: load("src/lib/billing/providers.ts"), calls, stripe, stripeSubscription, load };
}
test("Stripe checkout preserves configured price, redirects and metadata, adding durable idempotency", async () => {
  const h = providerHarness(); await h.adapter.createCheckout("STRIPE", user({ stripeCustomerId: null }), "attempt");
  const [, body, options] = h.calls.find(c => c[0] === "checkout");
  assert.equal(body.mode, "subscription"); assert.deepEqual(body.line_items, [{ price: "price", quantity: 1 }]);
  assert.equal(body.success_url, "https://app.test/pro/success?session_id={CHECKOUT_SESSION_ID}"); assert.equal(body.cancel_url, "https://app.test/pricing");
  assert.equal(body.metadata.userId, "u"); assert.equal(body.subscription_data.metadata.billingAttemptId, "attempt"); assert.equal(options.idempotencyKey, "attempt");
  assert.equal(h.calls[0][2].idempotencyKey, "customer:u");
});
test("Stripe grace evidence requires a paid nonzero invoice", async () => {
  const h = providerHarness(); assert.equal((await h.adapter.retrieve("STRIPE", "sub")).paidVerified, true);
  h.stripe.invoices.retrieve = async () => ({ status: "open", amount_paid: 0 });
  assert.equal((await h.adapter.retrieve("STRIPE", "sub")).paidVerified, false);
});
test("Stripe mismatched prices and test subscriptions cannot grant production PRO", async () => {
  const h = providerHarness(); h.stripeSubscription.items.data[0].price.id = "other"; await assert.rejects(h.adapter.retrieve("STRIPE", "sub"), /product/);
  h.stripeSubscription.items.data[0].price.id = "price"; h.stripeSubscription.livemode = false; await assert.rejects(h.adapter.retrieve("STRIPE", "sub"), /environment/);
});
test("Lemon checkout preserves store, variant and redirect without inventing idempotency support", async t => {
  const h = providerHarness(); let captured;
  t.mock.method(globalThis, "fetch", async (url, init) => { captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({ data: { id: "checkout", attributes: { url: "https://lemon.test", expires_at: "2030-01-01T00:00:00Z" } } }); });
  const result = await h.adapter.createCheckout("LEMONSQUEEZY", user(), "attempt");
  assert.equal(result.url, "https://lemon.test"); assert.equal(captured.body.data.relationships.store.data.id, "store");
  assert.equal(captured.body.data.relationships.variant.data.id, "variant"); assert.equal(captured.body.data.attributes.product_options.redirect_url, "https://app.test/pro/success");
  assert.equal(captured.body.data.attributes.checkout_data.custom.billingAttemptId, "attempt"); assert.ok(captured.init.signal); assert.equal(captured.init.headers["Idempotency-Key"], undefined);
});
test("Lemon production resource validation rejects a mismatched store", async t => {
  const h = providerHarness(); t.mock.method(globalThis, "fetch", async () => Response.json({ data: { id: "s", attributes: { store_id: "other", variant_id: "variant", test_mode: false } } }));
  await assert.rejects(h.adapter.retrieve("LEMONSQUEEZY", "s"), /product/);
});
test("provider timeouts become controlled outage errors", async () => {
  const h = providerHarness(); h.stripe.subscriptions.retrieve = async () => { throw new Error("ECONNRESET"); };
  await assert.rejects(h.adapter.retrieve("STRIPE", "sub"), e => e.status === 503 && !e.message.includes("ECONNRESET"));
});
test("an open Stripe checkout remains fenced regardless of local expiration", async () => {
  const h = providerHarness(); assert.equal(await h.adapter.checkoutClosed("STRIPE", "checkout"), false);
  h.stripe.checkout.sessions.retrieve = async () => ({ status: "expired" }); assert.equal(await h.adapter.checkoutClosed("STRIPE", "checkout"), true);
});
test("Lemon expired checkout recovery requires a fresh provider expiration value", async t => {
  const h = providerHarness(); t.mock.method(globalThis, "fetch", async () => Response.json({ data: { id: "checkout", attributes: {} } }));
  assert.equal(await h.adapter.checkoutClosed("LEMONSQUEEZY", "checkout"), false);
});
test("Lemon payment leaves a reusable hosted checkout fenced until verified closure", async () => {
  const s = sub("LEMONSQUEEZY"), h = harness({ initialUser: associated(s), subscriptions: [s] });
  h.state.attempts.push({ id: "attempt", provider: "LEMONSQUEEZY", userId: "u", status: "CREATING", providerCheckoutId: "hosted" });
  await h.service.webhook(notice(s, { attemptId: "attempt" })); assert.equal(h.state.attempts[0].status, "PAID_OPEN");
  await assert.rejects(h.service.deleteAccount("u"), /Pending checkout/);
  await assert.rejects(h.service.recover("u", "admin", "Investigated paid hosted checkout"), /unproven/);
  h.options.checkoutClosed = true; await h.service.recover("u", "admin", "Provider confirmed hosted link expiration");
  assert.equal(h.state.attempts[0].status, "RECONCILED");
});
test("an open checkout cannot be reused after provider activation ahead of its webhook", async () => {
  const h = harness(); await h.service.checkout("u", "STRIPE");
  const s = sub(); h.remote.set(`STRIPE:${s.providerSubscriptionId}`, s);
  await assert.rejects(h.service.checkout("u", "STRIPE"), /existing subscription/);
});
test("ambiguous customer mapping prevents cancellation and new checkout", async () => {
  const s = sub(), h = harness({ initialUser: associated(s), subscriptions: [s] }); h.state.users[1].stripeCustomerId = s.providerCustomerId;
  await assert.rejects(h.service.deleteAccount("u"), /Ambiguous/); assert.ok(!h.calls.includes("cancel:STRIPE"));
});
test("expired unverified subscription rows cannot manufacture a PRO grant", async () => {
  const h = harness(), s = sub("STRIPE", { status: "canceled" }); h.remote.set(`STRIPE:${s.providerSubscriptionId}`, s);
  h.state.users[0].stripeCustomerId = s.providerCustomerId;
  h.state.subscriptions.push({ provider: "LEMONSQUEEZY", providerSubscriptionId: "unverified", userId: "u", lastVerifiedAt: null });
  await h.service.webhook(notice(s)); assert.equal(h.state.users[0].plan, "FREE");
});
test("known ownership conflicts do not activate outage grace", async () => {
  const s = sub(), initial = associated(s, { plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(0), billingGraceUntil: new Date(Date.now() + DAY) });
  const h = harness({ initialUser: initial, subscriptions: [s] }); h.state.users[1].stripeCustomerId = s.providerCustomerId;
  assert.equal(+(await h.service.refreshAccess(initial)).billingAccessUntil, 0);
});
test("legacy trial access is reconciled from the provider rather than trusted from its email or status", async () => {
  const s = sub("LEMONSQUEEZY", { status: "on_trial", paidVerified: false, trialEndsAt: new Date(Date.now() + DAY) });
  const initial = associated(s, { plan: "PRO", subscriptionStatus: "on_trial" }), h = harness({ initialUser: initial, subscriptions: [s] });
  const verified = await h.service.refreshAccess(initial); assert.equal(verified.subscriptionStatus, "active");
  assert.equal(+verified.billingAccessUntil, +s.trialEndsAt); assert.equal(verified.billingGraceUntil, null);
});

test("legacy outage reconciliation never renews or persists the cutover deadline as paid evidence", async () => {
  const deadline = new Date(Date.now() + DAY);
  const initial = user({ plan: "PRO", subscriptionStatus: "active", subscriptionId: "legacy", legacyReconciliationDeadlineAt: deadline });
  const h = harness({ initialUser: initial }); h.options.outage = true;
  const results = await Promise.all(Array.from({ length: 12 }, () => h.service.refreshAccess(initial)));
  assert.ok(results.every(result => result.plan === "PRO" && +result.billingAccessUntil === +deadline));
  assert.equal(h.state.users[0].billingAccessUntil, null);
  assert.equal(+h.state.users[0].legacyReconciliationDeadlineAt, +deadline);
  h.state.users[0].legacyReconciliationDeadlineAt = new Date(0); // Synthetic already-expired cutover fixture.
  assert.equal((await h.service.refreshAccess(initial)).plan, "FREE");
});
test("missing legacy deadline and new FREE snapshots cannot obtain outage access", async () => {
  for (const fields of [{ plan: "PRO", subscriptionStatus: "active" },
    { plan: "FREE", subscriptionStatus: "active", legacyReconciliationDeadlineAt: new Date(Date.now() + DAY) }]) {
    const initial = user({ ...fields, subscriptionId: "legacy" }), h = harness({ initialUser: initial }); h.options.outage = true;
    assert.equal((await h.service.refreshAccess(initial)).plan, "FREE");
  }
});
test("verified Lemon access is retained while Stripe fails independently", async () => {
  const lemon = sub("LEMONSQUEEZY"), initial = associated(lemon, { subscriptionId: "stripe-unknown" });
  const h = harness({ initialUser: initial, subscriptions: [lemon] }); h.options.providerOutage = "STRIPE";
  const result = await h.service.refreshAccess(initial);
  assert.equal(result.plan, "PRO"); assert.equal(+result.billingAccessUntil, +lemon.currentPeriodEndsAt);
  assert.equal(h.state.subscriptions.length, 1); assert.ok(h.state.subscriptions[0].lastVerifiedAt);
});
test("local conflicting customer mappings deny legacy access before an unavailable provider is called", async () => {
  const s = sub(), initial = associated(s, { plan: "PRO", subscriptionStatus: "active", legacyReconciliationDeadlineAt: new Date(Date.now() + DAY) });
  const h = harness({ initialUser: initial }); h.state.users[1].stripeCustomerId = s.providerCustomerId; h.options.outage = true;
  const before = structuredClone(h.state.users);
  assert.equal((await h.service.refreshAccess(initial)).plan, "FREE");
  assert.deepEqual(h.state.users, before); assert.ok(!h.calls.some(call => call.startsWith("retrieve:")));
});
test("foreign and deleted subscription ownership cannot be hidden by provider outage", async () => {
  for (const owner of ["admin", null]) {
    const s = sub(), initial = associated(s, { plan: "PRO", subscriptionStatus: "active", legacyReconciliationDeadlineAt: new Date(Date.now() + DAY) });
    const h = harness({ initialUser: initial }); h.state.subscriptions.push({ ...s, userId: owner, lastVerifiedAt: new Date() }); h.options.outage = true;
    const before = structuredClone(h.state.subscriptions);
    assert.equal((await h.service.refreshAccess(initial)).plan, "FREE"); assert.deepEqual(h.state.subscriptions, before);
  }
});
test("independently verified provider survives another provider ownership conflict", async () => {
  const lemon = sub("LEMONSQUEEZY"), stripe = sub();
  const initial = associated(lemon, { subscriptionId: stripe.providerSubscriptionId, stripeCustomerId: stripe.providerCustomerId });
  const h = harness({ initialUser: initial, subscriptions: [lemon, stripe] });
  h.state.users[1].stripeCustomerId = stripe.providerCustomerId;
  assert.equal((await h.service.refreshAccess(initial)).plan, "PRO");
  assert.equal(h.state.subscriptions.length, 1); assert.equal(h.state.subscriptions[0].provider, "LEMONSQUEEZY");
});
test("database verification errors fail closed rather than returning raw stored PRO", async () => {
  const initial = user({ plan: "PRO", subscriptionStatus: "active" }), h = harness({ initialUser: initial });
  h.prisma.$transaction = async () => { throw new Error("PRIVATE_SQL SECRET_CONNECTION"); };
  await assert.rejects(h.service.refreshAccess(initial), error => error.status === 503 && !/PRIVATE|SECRET/.test(error.message));
});

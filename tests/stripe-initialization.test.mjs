import assert from "node:assert/strict";
import fs from "node:fs";
import { mock, test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

// Billing semantics are exercised by phase3-billing; these retain the lazy SDK
// regression boundary after routes delegate to the authoritative billing service.
mock.method(globalThis, "fetch", () => { throw new Error("Network forbidden"); });
const routes = ["stripe/create-checkout-session", "stripe/customer-portal", "stripe/webhook", "settings/delete", "account/delete",
  "lemonsqueezy/create-checkout", "lemonsqueezy/customer-portal", "lemonsqueezy/webhook", "billing/recover"];
function harness({ signedIn = true, failConstruction = false, invalidSignature = false } = {}) {
  const constructions = [], calls = [];
  let event = { id: "evt", type: "unused.event", created: 1, data: { object: {} } };
  class MockStripe {
    constructor(...args) {
      constructions.push(args); if (failConstruction) throw new Error("SDK initialization failed");
      this.webhooks = { constructEvent: (...args) => { calls.push(["verify", ...args]); if (invalidSignature) throw new Error("Signature invalid"); return event; } };
    }
  }
  const load = createLoader({ "server-only": {}, stripe: { __esModule: true, default: MockStripe },
    "@/lib/auth": { getCurrentUser: async () => signedIn ? { id: "u" } : null },
    "@/lib/prisma": { prisma: new Proxy({}, { get() { throw new Error("Unexpected database operation"); } }) },
    "@/lib/billing/service": {
      webhook: async notice => { calls.push(["webhook", notice]); },
      checkout: async () => { calls.push(["checkout"]); return { url: "https://checkout.example" }; },
      billingPortal: async () => ({ url: "https://portal.example" }),
      deleteAccount: async id => { calls.push(["delete", id]); },
      recover: async () => {},
    },
    "./service": {
      checkout: async () => { calls.push(["checkout"]); return { url: "https://checkout.example" }; },
      billingPortal: async () => ({ url: "https://portal.example" }),
      deleteAccount: async id => { calls.push(["delete", id]); },
    },
  }, { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, LEMONSQUEEZY_API_KEY: undefined,
    LEMONSQUEEZY_WEBHOOK_SECRET: undefined, DATABASE_URL: undefined });
  return { load, constructions, calls, setEvent: value => { event = value; } };
}
function request(signature = "signature") { return new Request("https://example.test", { method: "POST", body: "signed-body",
  headers: signature ? { "stripe-signature": signature } : {} }); }
function configure(load) { load.environment.STRIPE_SECRET_KEY = Symbol("mock credential"); load.environment.STRIPE_WEBHOOK_SECRET = Symbol("mock signing secret"); }
for (const path of ["src/lib/stripe.ts", "src/lib/billing/providers.ts", "src/lib/billing/service.ts", ...routes.map(p => `src/app/api/${p}/route.ts`)]) {
  test(`credential-free import: ${path}`, () => { const h = harness(); h.load(path); assert.deepEqual(h.constructions, []); assert.deepEqual(h.calls, []); });
}
for (const path of ["stripe/create-checkout-session", "stripe/customer-portal", "settings/delete", "account/delete", "billing/recover"]) {
  test(`unauthorized request avoids initialization: ${path}`, async () => {
    const h = harness({ signedIn: false }), route = h.load(`src/app/api/${path}/route.ts`);
    const response = path.endsWith("delete") ? await route.DELETE(request()) : await route.POST(request());
    assert.equal(response.status, 401); assert.deepEqual(h.constructions, []); assert.deepEqual(h.calls, []);
  });
}
test("missing runtime credential has a typed controlled error", () => {
  const h = harness(), { getStripe, StripeConfigurationError } = h.load("src/lib/stripe.ts");
  assert.throws(getStripe, e => e instanceof StripeConfigurationError && e.code === "STRIPE_NOT_CONFIGURED"); assert.deepEqual(h.constructions, []);
});
test("first runtime use caches one client and preserves default SDK options", () => {
  const h = harness(), { getStripe } = h.load("src/lib/stripe.ts"); assert.throws(getStripe); configure(h.load);
  assert.equal(getStripe(), getStripe()); assert.deepEqual(h.constructions, [[h.load.environment.STRIPE_SECRET_KEY]]);
});
test("failed SDK construction is retryable", () => {
  const h = harness({ failConstruction: true }); configure(h.load); const { getStripe } = h.load("src/lib/stripe.ts");
  assert.throws(getStripe, /initialization failed/); assert.throws(getStripe, /initialization failed/); assert.equal(h.constructions.length, 2);
});
test("webhook without signature never initializes Stripe", async () => {
  const h = harness(); assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request(null))).status, 400); assert.equal(h.constructions.length, 0);
});
test("webhook missing runtime credentials returns a controlled error", async () => {
  const h = harness(); assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request())).status, 400); assert.equal(h.constructions.length, 0);
});
test("invalid webhook signature cannot reach billing service", async () => {
  const h = harness({ invalidSignature: true }); configure(h.load);
  assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request())).status, 400); assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], "verify");
});
test("signed subscription events delegate identity to authoritative reconciliation", async () => {
  const h = harness(); configure(h.load); h.setEvent({ id: "evt", type: "customer.subscription.updated", created: 1,
    data: { object: { id: "sub", customer: "customer", metadata: { userId: "u" } } } });
  assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request())).status, 200);
  assert.equal(h.calls[1][1].subscriptionId, "sub"); assert.equal(h.calls[1][1].eventId, "evt"); assert.equal(h.calls[1][1].rawBody, "signed-body");
});
test("checkout completion retains subscription and attempt references", async () => {
  const h = harness(); configure(h.load); h.setEvent({ id: "evt", type: "checkout.session.completed", created: 1,
    data: { object: { subscription: "sub", customer: "customer", metadata: { userId: "u", billingAttemptId: "attempt" } } } });
  assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request())).status, 200); assert.equal(h.calls[1][1].attemptId, "attempt");
});
test("unhandled signed events are acknowledged without reconciliation", async () => {
  const h = harness(); configure(h.load); assert.equal((await h.load("src/app/api/stripe/webhook/route.ts").POST(request())).status, 200); assert.equal(h.calls.length, 1);
});
test("Stripe server-only boundary is enforced", () => {
  assert.match(fs.readFileSync(new URL("../src/lib/stripe.ts", import.meta.url), "utf8"), /^import "server-only";/);
  assert.throws(() => createLoader()("src/lib/stripe.ts"), /cannot be imported from a Client Component/);
});

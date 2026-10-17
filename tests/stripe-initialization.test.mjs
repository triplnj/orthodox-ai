import assert from "node:assert/strict";
import fs from "node:fs";
import { mock, test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Network calls forbidden in Stripe tests"); });
mock.method(console, "error", () => {});

const checkoutPath = "src/app/api/stripe/create-checkout-session/route.ts";
const portalPath = "src/app/api/stripe/customer-portal/route.ts";
const webhookPath = "src/app/api/stripe/webhook/route.ts";
const deletePath = "src/app/api/settings/delete/route.ts";
const user = {
  id: "user-id", email: "user@example.com", name: "User", emailVerified: new Date(),
  stripeCustomerId: "customer-id", subscriptionId: "subscription-id", subscriptionStatus: "active",
};

function harness({ signedIn = true, dbUser = user, failConstruction = false, invalidSignature = false } = {}) {
  const constructions = [];
  const calls = [];
  let event = { type: "unused.event", data: { object: {} } };
  function operation(name, result) {
    return async (...args) => { calls.push({ name, args }); return result; };
  }
  class MockStripe {
    constructor(...args) {
      constructions.push(args);
      if (failConstruction) throw new Error("SDK initialization failed");
      this.customers = { create: operation("customer.create", { id: "new-customer-id" }) };
      this.checkout = { sessions: { create: operation("checkout.create", { url: "https://checkout.example.com" }) } };
      this.billingPortal = { sessions: { create: operation("portal.create", { url: "https://portal.example.com" }) } };
      this.subscriptions = {
        retrieve: operation("subscription.retrieve", { id: "subscription-id", customer: "customer-id", status: "active" }),
        cancel: operation("subscription.cancel", {}),
      };
      this.webhooks = { constructEvent: (...args) => {
        calls.push({ name: "webhook.verify", args });
        if (invalidSignature) throw new Error("Invalid signature");
        return event;
      } };
    }
  }
  const load = createLoader({
    "server-only": {},
    stripe: { __esModule: true, default: MockStripe },
    "@/lib/auth": { getCurrentUser: async () => signedIn ? user : null },
    "@/lib/session": { destroySession: operation("session.destroy", undefined) },
    "@/lib/prisma": { prisma: { user: {
      findUnique: operation("user.findUnique", dbUser),
      update: operation("user.update", dbUser),
      updateMany: operation("user.updateMany", { count: 1 }),
      delete: operation("user.delete", dbUser),
    } } },
  }, {
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    STRIPE_PRO_PRICE_ID: "price-id",
    NEXT_PUBLIC_APP_URL: "https://example.com",
  });
  return { load, constructions, calls, setEvent: (value) => { event = value; } };
}

function configure(load) {
  // Opaque presence markers are passed only to the mocked SDK, never real keys.
  load.environment.STRIPE_SECRET_KEY = Symbol("mock Stripe credential presence");
  load.environment.STRIPE_WEBHOOK_SECRET = Symbol("mock signing secret presence");
}

function webhookRequest(signature = "test-signature") {
  return new Request("https://example.com/api/stripe/webhook", {
    method: "POST", body: "raw signed payload",
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function deletionRequest() {
  return new Request("https://example.com/api/settings/delete", {
    method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }),
    headers: { "Content-Type": "application/json" },
  });
}

for (const file of ["src/lib/stripe.ts", checkoutPath, portalPath, webhookPath, deletePath]) {
  test(`credential-free import: ${file}`, () => {
    const { load, constructions, calls } = harness();
    assert.doesNotThrow(() => load(file));
    assert.deepEqual(constructions, []);
    assert.deepEqual(calls, [], "imports must not perform database, billing, or session operations");
  });
}

for (const file of [checkoutPath, portalPath, deletePath]) {
  test(`unauthorized request needs no Stripe credentials: ${file}`, async () => {
    const { load, constructions, calls } = harness({ signedIn: false });
    const route = load(file);
    const response = file === deletePath ? await route.DELETE(deletionRequest()) : await route.POST();
    assert.equal(response.status, 401);
    assert.deepEqual(constructions, []);
    assert.deepEqual(calls, []);
  });
}

test("webhook without a signature returns the existing 400 response without initialization", async () => {
  const { load, constructions } = harness();
  const response = await load(webhookPath).POST(webhookRequest(null));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Missing Stripe signature." });
  assert.deepEqual(constructions, []);
});

test("missing runtime key raises a typed, credential-free configuration error", () => {
  const { load, constructions } = harness();
  const { getStripe, StripeConfigurationError } = load("src/lib/stripe.ts");
  assert.throws(getStripe, (error) => error instanceof StripeConfigurationError
    && error.code === "STRIPE_NOT_CONFIGURED"
    && error.message === "Stripe credentials are not configured for this server operation.");
  assert.deepEqual(constructions, []);
});

test("first use reads runtime configuration and caches one client without changing SDK options", () => {
  const { load, constructions } = harness();
  const { getStripe } = load("src/lib/stripe.ts");
  assert.throws(getStripe, { code: "STRIPE_NOT_CONFIGURED" });
  configure(load);
  const client = getStripe();
  assert.equal(getStripe(), client);
  assert.deepEqual(constructions, [[load.environment.STRIPE_SECRET_KEY]]);
});

test("failed SDK initialization is not cached", () => {
  const { load, constructions } = harness({ failConstruction: true });
  configure(load);
  const { getStripe } = load("src/lib/stripe.ts");
  assert.throws(getStripe, /SDK initialization failed/);
  assert.throws(getStripe, /SDK initialization failed/);
  assert.equal(constructions.length, 2);
});

test("checkout and portal retain controlled 500 responses for missing runtime credentials", async () => {
  for (const file of [checkoutPath, portalPath]) {
    const { load, constructions, calls } = harness();
    const response = await load(file).POST();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: file === checkoutPath
      ? "Something went wrong while creating the Checkout session."
      : "Something went wrong while opening the billing portal." });
    assert.deepEqual(constructions, []);
    assert.ok(calls.every((call) => call.name === "user.findUnique"));
  }
});

test("missing credentials never delete an account whose subscription must be cancelled", async () => {
  const { load, calls } = harness();
  const response = await load(deletePath).DELETE(deletionRequest());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /Could not cancel your Stripe subscription/);
  assert.ok(calls.every((call) => call.name === "user.findUnique"));
});

test("deletion without a Stripe subscription needs no Stripe initialization", async () => {
  const { load, calls, constructions } = harness({ dbUser: { ...user, subscriptionId: null } });
  const response = await load(deletePath).DELETE(deletionRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(calls.map((call) => call.name), ["user.findUnique", "user.delete", "session.destroy"]);
  assert.deepEqual(constructions, []);
});

test("checkout preserves customer creation, price, URLs, metadata, and one shared client", async () => {
  const { load, calls, constructions } = harness({ dbUser: { ...user, stripeCustomerId: null } });
  configure(load);
  const response = await load(checkoutPath).POST();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: "https://checkout.example.com" });
  assert.deepEqual(calls.find((call) => call.name === "customer.create").args, [{
    email: user.email, name: user.name, metadata: { userId: user.id },
  }]);
  assert.deepEqual(calls.find((call) => call.name === "checkout.create").args, [{
    mode: "subscription", customer: "new-customer-id", line_items: [{ price: "price-id", quantity: 1 }],
    success_url: "https://example.com/pro/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://example.com/pricing", metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
  }]);
  assert.equal(constructions.length, 1);
});

test("portal preserves customer ID, return URL, and response", async () => {
  const { load, calls } = harness();
  configure(load);
  const response = await load(portalPath).POST();
  assert.deepEqual(await response.json(), { url: "https://portal.example.com" });
  assert.deepEqual(calls.find((call) => call.name === "portal.create").args,
    [{ customer: "customer-id", return_url: "https://example.com/pro" }]);
});

test("subscription cancellation completes before local account deletion", async () => {
  const { load, calls } = harness();
  configure(load);
  const response = await load(deletePath).DELETE(deletionRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map((call) => call.name), [
    "user.findUnique", "subscription.retrieve", "subscription.cancel", "user.delete", "session.destroy",
  ]);
  assert.deepEqual(calls.find((call) => call.name === "subscription.cancel").args, ["subscription-id"]);
});

for (const [type, status, plan] of [
  ["customer.subscription.created", "active", "PRO"],
  ["customer.subscription.updated", "trialing", "PRO"],
  ["customer.subscription.updated", "past_due", "FREE"],
  ["customer.subscription.deleted", "canceled", "FREE"],
]) {
  test(`webhook preserves entitlement handling: ${type}/${status}`, async () => {
    const { load, calls, setEvent } = harness();
    configure(load);
    setEvent({ type, data: { object: { id: "subscription-id", customer: "customer-id", status } } });
    const response = await load(webhookPath).POST(webhookRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    assert.deepEqual(calls[0], { name: "webhook.verify", args: [
      "raw signed payload", "test-signature", load.environment.STRIPE_WEBHOOK_SECRET,
    ] });
    assert.deepEqual(calls.find((call) => call.name === "user.updateMany").args, [{
      where: { stripeCustomerId: "customer-id" },
      data: { plan, subscriptionStatus: status,
        subscriptionId: type.endsWith("deleted") ? null : "subscription-id" },
    }]);
  });
}

test("checkout webhook preserves account linking and subscription retrieval", async () => {
  const { load, calls, setEvent } = harness();
  configure(load);
  setEvent({ type: "checkout.session.completed", data: { object: {
    metadata: { userId: user.id }, customer: "customer-id", subscription: "subscription-id",
  } } });
  const response = await load(webhookPath).POST(webhookRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map((call) => call.name), [
    "webhook.verify", "user.update", "subscription.retrieve", "user.updateMany",
  ]);
});

test("invalid webhook signatures preserve the 400 contract and never mutate users", async () => {
  const { load, calls } = harness({ invalidSignature: true });
  configure(load);
  const response = await load(webhookPath).POST(webhookRequest());
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid Stripe webhook signature." });
  assert.deepEqual(calls.map((call) => call.name), ["webhook.verify"]);
});

test("webhooks without runtime credentials return a controlled existing error response", async () => {
  const { load, calls, constructions } = harness();
  const response = await load(webhookPath).POST(webhookRequest());
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid Stripe webhook signature." });
  assert.deepEqual(calls, []);
  assert.deepEqual(constructions, []);
});

test("unhandled signed webhook events remain acknowledged without user mutations", async () => {
  const { load, calls } = harness();
  configure(load);
  const response = await load(webhookPath).POST(webhookRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  assert.deepEqual(calls.map((call) => call.name), ["webhook.verify"]);
});

test("Stripe module enforces the server-only boundary", () => {
  assert.match(fs.readFileSync(new URL("../src/lib/stripe.ts", import.meta.url), "utf8"), /^import "server-only";/);
  assert.throws(() => createLoader()("src/lib/stripe.ts"), /cannot be imported from a Client Component/);
});

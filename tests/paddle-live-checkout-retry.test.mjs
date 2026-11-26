import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const price = "pri_" + "p".repeat(26);
const product = "pro_" + "q".repeat(26);
const transactionId = "txn_" + "t".repeat(26);
const account = {
 id: "qa_livedemo", email: "payer@example.test", emailVerified: new Date(),
 billingDeletionRequestedAt: null,
};
const request = new Request("https://www.orthodoxai.app/api/paddle/live/checkout-authorization", {
 method: "POST", headers: { origin: "https://www.orthodoxai.app" },
});

test("server checkout creates one Paddle transaction and safely reopens the same transaction", async () => {
 let attempt = null, created = 0;
 const tx = {
   user: { findUnique: async () => ({
     emailVerified: new Date(), billingDeletionRequestedAt: null,
     subscriptionId: null, lemonSqueezySubscriptionId: null,
   }) },
   billingSubscription: { findMany: async () => [] },
   billingCheckoutAttempt: { findFirst: async () => null },
   $queryRaw: async (query, ...values) => {
     const sql = query.join(" ");
     if (sql.includes("pg_advisory_xact_lock")) return [{ locked: 1 }];
     if (sql.includes('FROM "PaddleLiveCheckoutAttempt"')) return attempt ? [attempt] : [];
     if (sql.includes('FROM "PaddleLiveSubscription"')) return [];
     if (sql.includes('UPDATE "PaddleLiveCheckoutAttempt"')) {
       assert.ok(attempt);
       attempt.providerTransactionId = values[0];
       return [{ id: attempt.id }];
     }
     throw Error("Unexpected SQL query: " + sql);
   },
   $executeRaw: async (query, ...values) => {
     if (query.join(" ").includes('INSERT INTO "PaddleLiveCheckoutAttempt"')) {
       attempt = { id: values[0], userId: values[1], status: "OPEN",
         expiresAt: values[2], providerTransactionId: null };
       return 1;
     }
     throw Error("Unexpected write");
   },
 };
 const originalFetch = globalThis.fetch;
 globalThis.fetch = async (url, options) => {
   if (String(url).endsWith("/transactions") && options?.method === "POST") {
     created++;
     const payload = JSON.parse(options.body);
     assert.equal(payload.collection_mode, "automatic");
     assert.equal(payload.items[0].price_id, price);
     assert.equal(payload.items[0].quantity, 1);
     assert.equal(payload.custom_data.orthodoxai_user_id, account.id);
     assert.ok(payload.custom_data.orthodoxai_checkout_attempt_id);
     return new Response(JSON.stringify({ data: {
       id: transactionId, collection_mode: "automatic", status: "draft",
     } }), { status: 201 });
   }
   if (String(url).endsWith("/transactions/" + transactionId)) {
     return new Response(JSON.stringify({ data: {
       id: transactionId, collection_mode: "automatic", status: "draft",
     } }), { status: 200 });
   }
   throw Error("Unexpected provider request");
 };
 try {
   const load = createLoader({
     "next/server": { NextResponse: { json: (body, opts = {}) =>
       ({ body, status: opts.status ?? 200 }) } },
     "@/lib/session": { getSessionUser: async () => account },
     "@/lib/prisma": { prisma: { $transaction: async fn => fn(tx) } },
   }, {
     VERCEL_ENV: "production", BLOG_ADMIN_USER_IDS: "unrelated_admin",
     PADDLE_LIVE_CHECKOUT_ENABLED: "enabled",
     PADDLE_LIVE_GRANT_ACCESS: "enabled",
     PADDLE_LIVE_RECONCILIATION_READY: "enabled",
     PADDLE_LIVE_WEBHOOK_ENABLED: "enabled",
     PADDLE_LIVE_API_KEY: "pdl_live_apikey_" + "a".repeat(30),
     PADDLE_LIVE_BINDING_SECRET: "a".repeat(48),
     PADDLE_LIVE_PRO_PRICE_ID: price,
     PADDLE_LIVE_PRO_PRODUCT_ID: product,
     NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN: "live_" + "a".repeat(26),
   });
   const route = load("src/app/api/paddle/live/checkout-authorization/route.ts");
   const first = await route.POST(request);
   assert.equal(first.status, 200);
   assert.equal(first.body.transactionId, transactionId);
   assert.equal(first.body.paymentEnabled, true);
   const repeat = await route.POST(request);
   assert.equal(repeat.status, 200);
   assert.equal(repeat.body.transactionId, transactionId);
   assert.equal(created, 1);
 } finally {
   globalThis.fetch = originalFetch;
 }
});

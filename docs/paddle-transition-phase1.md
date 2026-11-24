# Paddle transition: Phase 1 — safe preparation (20 Nov 2026)

**Status: NOT LIVE. No Paddle checkout route is exposed, no subscriptions are provisioned, and no existing billing records are changed.** Preserve the existing Lemon Squeezy and Stripe legacy integrations until verified Paddle onboarding and sandbox end-to-end testing.

## Sandbox catalog created by account owner
- Product: `OrthodoxAI Pro`; ID `pro_01m84hpaffkkag5zftcz3nk9qz`
- Monthly price: `pri_01m84j47gzd7tw449trss5wsh4` (user-configured USD 7.99/month; still confirm directly via the sandbox API before relying on it)
- These IDs are **Sandbox only** and are recorded in `src/lib/billing/paddle-sandbox-catalog.ts`.
- Do not put them in live environment variables, enable checkout or grant subscriptions based solely on supplied IDs.

## Next Paddle Sandbox settings
1. In **My account → Settings → Authentication → Client-side tokens**, create a token for OrthodoxAI QA, beginning `test_` (safe for front-end but place in a preview-specific environment variable).
2. In **Authentication → API keys**, create a Sandbox API key with the minimum permissions needed, for example catalog read and later sandbox checkout/transaction operations. **Do not share the API key in GitHub or a chat.**
3. Set the Sandbox API base URL `https://sandbox-api.paddle.com`; never send sandbox credentials to `https://api.paddle.com`.
4. In Checkout configuration set and approve a testing payment link/domain as required by Paddle, using a safe preview test host; do not point live users to this integration.
5. Add secrets only to a dedicated preview/staging environment after verifying that it cannot reuse the live app's database for payment state changes.

## External account gate
1. Create a Paddle seller account at https://login.paddle.com/ and a **separate** sandbox at https://sandbox-login.paddle.com/.
2. Confirm that Paddle can onboard the *actual* Serbian legal entity / sole proprietor, and verify payout currency, payout method, minimum payout and banking documents. Availability by country is not approval.
3. Submit `orthodoxai.app` and `www.orthodoxai.app` for website approval, and confirm privacy, terms, refund policy, price and product descriptions are linked.
4. In sandbox, create a recurring **USD 7.99/month** OrthodoxAI Pro product and price. Do not copy test price IDs to production.
5. Create a separate sandbox webhook notification destination and signing secret, with events `transaction.completed`, `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.past_due` (review Paddle's current event names when enabling).
6. Keep API keys and webhook signing secrets only in Vercel environment variables, never in Git.

## Proposed environment variable contract (not created yet)
- `PADDLE_ENVIRONMENT=sandbox|production` (default disabled)
- `PADDLE_API_KEY` (server-only, environment-specific)
- `PADDLE_WEBHOOK_SECRET` (server-only, environment-specific)
- `PADDLE_PRO_PRICE_ID` (server-only)
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (client-side token, not API key)
- `PADDLE_CHECKOUT_ENABLED=false` (must remain false until explicit go-live review)

## Billing data architecture and safety gates
- Retain existing `BillingSubscription`, `BillingCheckoutAttempt`, `BillingWebhookEvent` data; **do not** relabel old Lemon Squeezy attempts or erase records.
- A new Paddle provider requires a **separately reviewed schema migration**: both `BillingSubscription` and `BillingCheckoutAttempt`/database CHECK constraints must accept `PADDLE` and any sandbox-specific test provider; user-to-Paddle customer/subscription mapping must be designed.
- Build a sandbox checkout that carries immutable internal `userId` and an unguessable checkout attempt identifier as Paddle custom data, with verified server-side ownership before fulfillment.
- Paddle.js/browser success redirects are **not proof of payment**. Accept only authenticated, idempotent Paddle webhooks, corroborated by Paddle API subscription/invoice/transaction state, before granting Pro.
- Verify raw-body `Paddle-Signature` timestamp/HMAC with `src/lib/billing/paddle-webhook.ts`; the module is currently isolated and unused.
- Handle event ordering, duplicate deliveries, cancellations, refunds, past-due/grace periods, and provider outages. Never silently downgrade legitimate existing paid users.
- Keep sandbox and live data segregated. Never let a sandbox event modify a live `users.plan` or entitlement.
- No changes to current checkout/navigation/layout in phase 1.

## Safe implementation sequence
1. **This PR:** documentation, pure webhook signature verifier and tests. No production behavioral change.
2. After Paddle sandbox credentials: implement sandbox-only API client, signed webhook ingestion and idempotency tests, with feature flag off.
3. Review and apply reversible migration; add Paddle as a first-class billing provider (entitlement, history, recover, customer portal, cancellation, account deletion, test isolation).
4. Perform full sandbox lifecycle: free -> checkout -> payment -> webhook -> Pro -> renewal -> failed charge -> cancel/refund, including spoofed and duplicate webhooks.
5. Verify merchant approval, payout eligibility and live product; use a controlled live checkout with explicit owner approval.
6. Only then move customer CTA to Paddle. Retain records and reconcile any live Lemon subscriptions individually before shutdown.

## First run
`node --test tests/paddle-webhook.test.mjs`

## Official references
- https://www.paddle.com/help/start/account-verification/which-countries-are-supported-by-paddle
- https://www.paddle.com/help/start/account-verification/what-is-domain-verification
- https://developer.paddle.com/get-started/quickstart/
- https://developer.paddle.com/webhooks/about/signature-verification/
- https://developer.paddle.com/build/go-live-checklist/

## Preview catalog verification without a login

The dedicated `GET /api/admin/paddle/catalog-check` is an **intentionally public but read-only diagnostic** on the exact Vercel Preview branch `feature/paddle-transition-phase1-20261120`. It needs no OrthodoxAI login, session cookie, AUTH_RATE_LIMIT_SECRET or database, and performs only two fixed, server-side Paddle Sandbox catalog GETs using a secret server-side token. The response exposes public product and price metadata only, never the API key, raw upstream responses, customers, or subscription data. It returns 404 everywhere except the named Vercel Preview branch. Set `PADDLE_API_KEY` on that branch, redeploy, then open `https://<preview-host>/api/admin/paddle/catalog-check` directly. A 200 response with `verified: true` and `amountMinorUnits: "799"` confirms the USD 7.99 monthly catalog. A 503 means API key, permissions or network need checking; a 409 means the catalog's settings do not match. Do not enable live checkout based on this read-only check.

The verification endpoint is **not an administrator dashboard or an access-controlled management API**. Remove or disable it after checking, or protect the entire Preview deployment with Vercel Deployment Protection. Do not extend this unauthenticated endpoint with any account, checkout, subscription, write or privileged operations.

## Catalog verification outcome — 23 Nov 2026

The account owner opened the branch-only read-only diagnostic endpoint and reported `verified: true`: product `pro_01m84hpaffkkag5zftcz3nk9qz` active, price `pri_01m84j47gzd7tw449trss5wsh4` active, USD 799 minor units, month interval with frequency 1, Sandbox mode. This confirms *catalog reads only*, not checkout, payment, webhook delivery or plan provisioning.

The one-time public catalog diagnostic route was subsequently deleted from this PR. A future deployment of this PR will not expose it. Existing preview deployment URLs may temporarily retain its compiled route and should not be treated as permanent diagnostics.

Next prerequisites: a separate `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` for Sandbox client integration, a Paddle Sandbox webhook signing secret, and a proven isolated test database + authenticated QA user before implementing payment-state writes. Do not use production Neon to simulate webhook deliveries.

## Phase 1 webhook receiver — 23 Nov 2026

`POST /api/paddle/webhook` is now present in the **Paddle feature branch only**, under all of these restrictions:
- Requires Vercel `preview` and exact `feature/paddle-transition-phase1-20261120` branch; production requests return 404.
- Requires separate Paddle Sandbox destination secret stored as `PADDLE_WEBHOOK_SECRET`, configured **only** for this Preview branch. It is distinct from the API key, and must never be committed to Git or shared in chat.
- Rejects invalid HMAC signatures, stale timestamps (30 seconds), large bodies and malformed event envelopes.
- Returns `{ received: true, verified: true, mode: "SANDBOX_VERIFY_ONLY" }` only after verification. **Does not save webhooks, subscriptions, transactions, or entitlement data and DOES NOT deliver Pro.** Never treat the response as transaction fulfillment.
- An acknowledged notification is discarded; use this receiver only for initial connection/signature testing, not for checkout or full payment lifecycle testing. Implement idempotent persistent sandbox event processing using a separate DB before creating any test checkout.

Paddle Sandbox Notifications → New destination: Webhook, URL `https://<actual-preview-host>/api/paddle/webhook`, usage type Platform (or Both if testing Paddle simulations), API version 1, Description `OrthodoxAI Sandbox – Subscription and Payment Events`. Select `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`, `transaction.canceled`, `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`. **Do not save destination until the Preview URL and signing secret setup are ready.** Paddle needs to reach the Preview without a Vercel login wall. A webhook endpoint secret is generated **after** creating a destination, so temporary setup may require creating the destination first with events disabled or a placeholder, then setting the secret and enabling delivery; validate exact workflow in UI before doing so.

The Vercel account's old-email security challenge currently prevents the owner from changing project settings. This blocks setting `PADDLE_WEBHOOK_SECRET` on the correct Preview project. Do not bypass account verification or use shared Production env vars to work around this.

## Deployment refresh after webhook secret setup

After configuring `PADDLE_WEBHOOK_SECRET` only in the Paddle Preview branch, a new branch commit triggers a fresh Preview deployment and loads the updated environment. This is intentionally not a production redeployment. The initial webhook receiver verifies signatures and acknowledges test events but does not process subscription state or write to Neon. Never send actual payments or production notifications to it.

## Sandbox signing secret 503 troubleshooting

A 503 response with `Sandbox webhook verification is not configured.` comes from `src/app/api/paddle/webhook/route.ts` and means that `PADDLE_WEBHOOK_SECRET` is absent in this deployment or does not start with the official Paddle notification destination signing secret prefix `pdl_ntfset_`. The Paddle API secret key and client-side token must **not** be used here. Verify the Preview target, exact branch restriction, and that the notification destination signing secret is used. Create a new Preview deployment after changing the variable, and update the Paddle destination URL to that new deployment's hostname while retaining the bypass query parameter if needed. Do not paste secret values into chat or commits.

## Preview rebuild after notification Signing Secret configuration (23 November 2026)

This documentation-only commit triggers a fresh Vercel Preview deployment on the Paddle feature branch after the owner entered the destination Signing Secret as `PADDLE_WEBHOOK_SECRET`. Production and `main` remain untouched. Check that the new deployment is READY, use its exact URL for webhook simulations, and keep the Vercel bypass token private and rotated if exposed.

## Separate Paddle QA database branch (23 Nov 2026)

Created Neon branch `orthodoxai-paddle-sandbox-2026-11-23` (`br-red-waterfall-asdlxovu`) in project `winter-mountain-30736951`, cloned from existing non-production branch `br-empty-breeze-asd2dqrq`, **not** the production branch. Creation returned `init`, so confirm it becomes ready. This is a dedicated branch intended for Paddle sandbox integration tests, and is **not yet connected to the Vercel Preview deployment**. Do not run billing mutations before verifying the correct `DATABASE_URL`/direct URL/Prisma settings are selected in the actual Vercel project `orthodox-ai` and branch-restricted to `feature/paddle-transition-phase1-20261120`. The Vercel connector is only authorized for a differently named project and cannot establish these settings. Never paste connection strings into chat or commits.

Next work in the feature PR: add server-side Paddle Sandbox checkout with authenticated user binding, explicit sandbox-only controls, no entitlements on redirect, and event persistence/reconciliation with idempotent handling and strict ownership checks. Do not switch the production Upgrade button or enable live events until full billing lifecycle is tested.

## Preview DATABASE_URL set for Paddle QA (23 Nov 2026)

Owner reports adding `DATABASE_URL` scoped to `feature/paddle-transition-phase1-20261120` Preview and pointing it at dedicated Neon branch `br-red-waterfall-asdlxovu`. Prisma runtime `src/lib/prisma.ts` uses `DATABASE_URL`. Migration tooling `prisma.config.ts` prefers `DIRECT_URL` when set: **before any Prisma migrate, confirm `DIRECT_URL` is absent or points to the same QA branch**. Adding a Preview env variable requires a fresh Preview deployment. Connection has not been independently verified on the running deployment, and no migration or subscription write has been executed. Production checkout remains Lemon Squeezy, no Paddle checkout activated.

## Stage 1 — user-bound Sandbox checkout intent (24 November 2026)

Added `POST /api/paddle/checkout-binding` (Preview feature branch only, same-origin POST required, session and verified email required), and `src/lib/billing/paddle-checkout-binding.ts`. The endpoint returns the fixed Sandbox price plus short-lived, HMAC-signed `customData` bound to the authenticated user, valid for 30 minutes. Tests cover tampering, expiry, invalid secrets and incorrect user IDs. The server-generated `customData` is intended to accompany the future Paddle Checkout.open call and be checked again in a signed webhook *before* reconciling subscription ownership. Paddle documents that checkout custom data is propagated to transaction and subscription events: https://developer.paddle.com/build/transactions/custom-data/ .

**Stage 1 is preparation only:** `paymentEnabled:false`, `mode:SANDBOX_BINDING_ONLY`; no Paddle Checkout.open call, payment, database writes or entitlement grants. Do not accept a browser-reported checkout success as verified ownership. Stage 2 needs persistent idempotency/ownership event storage and a verified QA database connection before payments can be enabled. Rotate any exposed Vercel protection bypass token.

## Stage 2 — QA-only idempotent event receipt (24 November 2026)

The dedicated Neon QA branch `br-red-waterfall-asdlxovu` contains the `PaddleSandboxBranchGuard` table with matching branch ID. This table and marker were created **only** in QA, not in production. The existing `BillingWebhookEvent` schema is reused, avoiding a global migration at this stage.

`src/lib/billing/paddle-event-store.ts` persists signed webhook event **metadata only** (Paddle event ID/type, SHA-256 body digest, optional subscription ID and occurrence time). The uniqueness key `(provider, eventId)` makes replay idempotent. A conflicting duplicate ID with different content fails closed. All writes are inside a transaction that first checks the QA-only database guard. No customer/payment JSON or credentials are stored.

The endpoint `POST /api/paddle/webhook` remains **verify-only by default**. Persistence requires explicit, branch-scoped Preview variable `PADDLE_SANDBOX_STORE_EVENTS=enabled`. Do **not** set it until the running Preview's `DATABASE_URL` is confirmed to point at `br-red-waterfall-asdlxovu`. If DB guard is missing or database is unavailable, the endpoint returns HTTP 503 and doesn't acknowledge unpersisted events. If enabled with correct QA DB, response is `mode:SANDBOX_EVENT_STORED` and `duplicate:true|false`.

Events remain in `RECEIVED` state, with **no entitlement, user-plan, subscription-state, or checkout mutation**. Automatic Pro grants still require independent verified transaction/customer ownership, paid amount and recurring period checks and an idempotent reconciler, which are future steps.

New isolated tests cover initial insertion, same-event deduplication, altered-body collision, and missing QA guard. Do not run Sandbox checkout as if it grants Pro.

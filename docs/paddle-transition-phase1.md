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

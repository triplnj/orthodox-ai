# Paddle Live migration runbook (preparation only)

**Live Paddle billing is NOT active.** Current production checkout, portal, entitlement and provider ledgers continue on the existing provider(s). Do not point live webhooks to the current `/api/paddle/webhook`: it is deliberately Preview/Sandbox-only.

## Phase A — merchant/account gates (owner action)
- Confirm Paddle live seller onboarding, identity/business approval and payout eligibility for the actual merchant.
- Confirm the live domain/website is approved, and the price, subscription and refund/terms/privacy disclosures are accurate.
- Create a **new Live** OrthodoxAI Pro product and **USD $7.99/month** price. Its IDs must differ from Sandbox IDs; never copy Sandbox IDs into Live.
- Generate a dedicated Live API key, a Live client-side token, and a **distinct** Live webhook notification destination/signing secret. Never put secrets in GitHub, tickets or chat.
- Required permissions for the future read/reconciliation and portal flows include subscription.read, transaction.read and customer_portal_session.write. Limit permissions to those actually required by implementation.
- Ensure live webhook events include completed transaction, subscription lifecycle and failed payment/refund-related events using the currently documented Paddle event names.

## Phase B — configuration contract (not deployed yet)
- `PADDLE_LIVE_API_KEY`: server-only; starts `pdl_live_apikey_`
- `PADDLE_LIVE_WEBHOOK_SECRET`: server-only; separate notification destination secret
- `NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN`: Live Paddle.js client token; starts `live_`
- `PADDLE_LIVE_PRO_PRODUCT_ID`: new live product `pro_...`
- `PADDLE_LIVE_PRO_PRICE_ID`: new live recurring monthly price `pri_...`
- `PADDLE_LIVE_CHECKOUT_ENABLED=disabled`
- `PADDLE_LIVE_GRANT_ACCESS=disabled`

The preflight in `src/lib/billing/paddle-live-config.ts` is **pure/read-only**. Even a valid preflight result **does not** enable purchases. Keep the old `PADDLE_API_KEY` and Sandbox settings Preview-only. Do not copy Sandbox secrets into production. Live requests will eventually use `https://api.paddle.com`, with a separately designed and reviewed connector.

## Phase C — implementation that still needs review
1. Add Paddle as a real provider via a reviewed, reversible migration to the billing tables and constraints. Preserve all Stripe/Lemon history, customer associations and outstanding entitlement.
2. Build live server-side checkout authorization, live-specific signed ownership binding, webhook verification, idempotent event storage, reconciliation and customer portal. All must be OFF by default and unavailable from the Preview sandbox endpoints.
3. Handle complete renewal and payment failures with explicit provider evidence per billing cycle; define grace periods and the plan for provider outages, chargebacks, refunds, partial payments, cancellations and event reordering.
4. Run regression tests for legacy providers and failure/retry cases. Reconcile existing customers individually; do not silently transfer a subscription from Lemon Squeezy to Paddle.
5. Have the owner approve a controlled first Live payment. Only after verified settlement, callbacks, portal and refunds, roll out the checkout CTA behind a separate feature gate with rollback.

## Operator verification before a live switch
- Confirm ownership, consent, approved seller account and correct Live catalog/banking; ensure no sandbox credentials in production.
- Verify production and staging database separation, webhook signing secret isolation, billing access expiry semantics, backups and observability.
- Ensure user-visible account/subscription status is derived from verified current provider state.
- **Do not enable Paddle in production or disable Lemon Squeezy yet.**

## Implementation staged on PR #77 (26 Nov 2026)

The following components are **source-only on the feature branch**, not in the
production application or the production Neon database:

- `prisma/migrations/20261126000000_paddle_live_staging/migration.sql`:
  a separate `PaddleLiveEvent` audit ledger and `PaddleLiveSubscription`
  verified-payment ledger. **Not applied** to production Neon.
- `/api/paddle/webhook`: production requests are delegated to the new Live
  handler only after this PR is deliberately merged. If
  `PADDLE_LIVE_WEBHOOK_ENABLED` is absent/disabled, it responds **404**.
  Sandbox Preview verification remains independent.
- `/api/paddle/live/checkout-authorization`: internal, same-origin,
  authenticated Live checkout proof route. It **never initiates a purchase**
  and returns `paymentEnabled: false`. It requires ALL of:
  `PADDLE_LIVE_CHECKOUT_ENABLED=enabled`,
  `PADDLE_LIVE_GRANT_ACCESS=enabled`,
  `PADDLE_LIVE_RECONCILIATION_READY=enabled`, and
  `PADDLE_LIVE_BINDING_SECRET` (at least 32 chars). **Keep unset/disabled.**
- `paddle-live-provider.ts` and `paddle-live-evidence.ts`:
  direct Live Paddle API subscription+transaction verification, signed original
  checkout ownership and fresh, completed positive payment for each cycle.
- `paddle-live-subscription-store.ts`: idempotent, ownership-locked ledger
  write for authenticated verified payment evidence; deliberately does **not**
  change `users.plan` or enable paid functionality.

**Do not activate the existing Paddle Live notification destination yet.**
A received webhook is not, by itself, a paid entitlement. The production
checkout UI, attempt ledger, verified access projection, refund/chargeback
handling, failure/grace policy and migrations/rollback still need review and
tests before any real payment.

### Next steps before enabling any Live flag
1. Apply migration ONLY after database backup, plan review, rollback preparation,
   and operator authorization; verify no conflict with Stripe/Lemon tables.
2. Add a dedicated `PADDLE_LIVE_BINDING_SECRET` (secure random 32+ chars) as
   Production Sensitive; **do not send the value into chat**.
3. Implement an idempotent live checkout attempt record before creating a payment,
   prohibit overlapping legacy subscriptions, and connect the approved checkout
   page with Paddle.js.
4. Add refund/chargeback evidence checks and support for recoverable failures,
   ensure customer portal and account deletion semantics work across providers.
5. Add a read-through entitlement reconciliation that does not overwrite or
   downgrade existing Lemon Squeezy subscribers.
6. Test the deployment against an isolated Neon branch. Confirm Live merchant
   approval and perform a user-approved controlled Live payment.
7. Activate notification destination and payment UI only with explicit approval
   after reconciliation and verified positive tests.

## Live checkout retry design (26 Nov 2026)
- Live checkout authorization creates one durable OPEN attempt and creates one
  Paddle transaction server-side with that attempt's signed owner data. The
  browser receives only the transaction ID and opens the SAME transaction
  using Paddle.js. An unexpired retry reopens that transaction rather than
  risking a second payment. Unknown provider outcomes stay fenced for manual
  reconciliation.
- The provider API key now additionally requires **transaction.write**, since
  Paddle transactions are created on the server. Provider reconciliation
  requires **adjustment.read** for refund/chargeback status. Read-only merchant
  preflight requires **verification.read**, **checkout_domain.read**, and
  **checkout_settings.read**. Grant no unrelated write permissions.
- A verified successful payment must match both the signed checkout attempt
  and the exact original Paddle transaction reserved in Neon; a checkout
  popup's success event alone never grants Pro.
- Keep all five Live feature flags disabled until merchant onboarding is
  completed, product and domain checks are green, webhook is enabled, and
  the first controlled real transaction has been tested.

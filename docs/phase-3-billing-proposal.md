# Phase 3 billing integrity — approval proposal

Status: proposed, not implemented. No customer records or provider APIs were
accessed. No application code, Prisma schema, or executable migration has been
changed. The proposed SQL lives outside `prisma/migrations` so it cannot be
applied inadvertently by the existing deployment command.

## Confirmed implementation gaps

- `/api/account/delete` considers only the Lemon Squeezy subscription ID and a
  shared, potentially stale status. It protects the two review accounts.
- `/api/settings/delete` considers only Stripe, attempts cancellation, then
  deletes the user. It omits the review-account restriction and does not verify
  all other subscriptions before deletion.
- Both webhooks overwrite `User.plan` and `User.subscriptionStatus`. Stripe
  updates all users matching a customer ID; Lemon Squeezy trusts the custom
  user ID and overwrites the current subscription ID. Neither records processed
  events or protects entitlement changes from old subscription events.
- `isProUser` accepts only `active`, despite Stripe provisioning `trialing` and
  Lemon Squeezy provisioning `on_trial` as PRO.
- Neither checkout endpoint prevents concurrent or cross-provider duplicate
  subscriptions. A customer can have historical subscriptions beyond the one ID
  currently held on the user record.
- The UI starts checkout and opens the portal through Lemon Squeezy routes.
  Those routes must retain their current response shape and support legitimate
  legacy Stripe subscribers when opening billing management.

## Proposed durable state

Keep every existing user billing field and provider identifier. Add three small
tables and a nullable deletion fence on User:

1. `BillingSubscription`: one row per provider/subscription ID, rather than one
   shared mutable status per user. Store provider customer and product IDs,
   verified status, trial/paid-period end, cancellation scheduling, and provider
   verification/version timestamps. Rows survive local account deletion with a
   null user reference. This preserves future subscription history and retains
   legacy references without deleting or rewriting payment-provider records.
2. `BillingWebhookEvent`: unique `(provider, eventId)`, payload digest,
   subscription reference, processing timestamps/status, and minimal diagnostic
   metadata. Signed Lemon Squeezy notifications without a delivery ID use a
   stable digest of the signed body as their replay identity. No payment-card
   information or secret keys are stored.
3. `BillingCheckoutAttempt`: a durable, cross-provider admission fence for one
   pending checkout per user. Record provider, attempt ID, provider checkout ID,
   expiration, and result. An unknown provider result remains fenced until
   reconciled; a timeout must never silently allow another purchase.
4. `User.billingDeletionRequestedAt`: fences checkout creation while deletion
   safety checks and provider cancellation are in progress.

The proposed migration seeds subscription reference rows from existing user IDs
without guessing which provider the shared old status belongs to. Seeded rows
are explicitly unverified; `User.plan`, statuses, subscription IDs, and payment
history remain unchanged. Reconciliation and entitlement rollout must be staged
so unverified legacy rows do not trigger a blanket downgrade.

## Authoritative deletion workflow

Both URLs delegate to one server-only service. The settings endpoint retains
its `DELETE` confirmation check; the account endpoint retains compatibility
with the existing bodyless UI request. Both enforce identical billing and
review-account protections.

Under the shared per-user billing lock, acquire a durable deletion fence and
check checkout attempts. Before deleting anything, inventory BOTH providers'
subscriptions using known customer IDs, stored references, and the new ledger.
Check customer subscription lists with pagination, not only the latest saved
subscription ID. An inaccessible provider or ambiguous association fails closed.

Cancel subscriptions that could renew through the corresponding provider, or
return the existing 409/portal handoff when customer action is needed. Re-fetch
provider state and require proof that automatic subscription billing has stopped.
Provider errors, pending checkout completion, unknown statuses, and cancellation
failures retain the account and its sessions. Partial success at one provider
does not permit deletion while the other could still bill. Cancellation must be
retry-safe. Preserve provider customers, payment records, ledger history, and
webhook receipts; delete local personal app data only after the safety checks.

## Provider-aware entitlement processing

- Verify webhook signatures before accepting a receipt or acting on metadata.
- Bind each provider subscription/customer/product to its user. A signed event
  for an old subscription cannot reassign a newer subscription or another user.
- Serialize receipt application and entitlement projection per user. Mark a
  receipt processed atomically with its durable subscription update.
- Treat events as reconciliation signals: verify current provider state instead
  of blindly applying delayed payload snapshots. Use provider/version guards
  and receipt deduplication; do not rely on timestamp ordering alone, because
  distinct Stripe events can share a timestamp.
- Recompute entitlement from all relevant provider records, so a cancelled old
  Stripe subscription cannot revoke an active Lemon Squeezy subscription.
- Grant valid Stripe trials (`trialing`) and Lemon Squeezy trials (`on_trial`).
  Preserve paid access through a verified paid period when cancellation is
  scheduled. Unknown or failed provider reconciliation must not manufacture a
  new PRO grant from untrusted client input or downgrade another active record.
- Retain the existing user fields as compatibility projections for existing
  pages and APIs. Preserve explicit review-account access. AI quota definitions,
  prompts, and research code are out of scope; legitimate trial PRO entitlement
  will naturally use the existing PRO rules.

## Cross-provider checkout and portal compatibility

Use one service and billing lock for both checkout URLs. Require verified email,
reject checkout during deletion, and check both providers for active, trial,
paused, overdue, or other potentially billable subscriptions. Reuse a known valid
open checkout instead of issuing another. Preserve all existing configured price
IDs, product IDs, metadata, success/cancel URLs, and `{ url }` response shapes.

Stripe supports request idempotency keys; use the durable attempt ID. Do not
assume Lemon Squeezy implements equivalent semantics: keep a durable fence and
reconcile ambiguous results rather than retrying purchase creation blindly.

Lemon Squeezy stays the current checkout provider in the UI. Keep Stripe routes
and portal functionality. The current UI portal endpoint should choose the
appropriate provider for the user's subscription and expose a clear conflict
when multiple provider subscriptions need management.

## Validation and deployment, after approval

Implement mocks for provider inventory, cancellation/re-fetch, checkout, and
webhooks. Test activation, renewal, both trial states, period-end cancellation,
replay, out-of-order events, old subscription IDs, equal timestamps, dual-provider
access, simultaneous checkout, ambiguous failures, both deletion URLs, protected
review accounts, and failed/partial cancellations. Update prior tests whose
assertions encode the old incorrect trial/deletion behavior; do not change AI
quota source or limits.

Run all regression suites with process isolation and bounded deadlines, followed
by TypeScript, ESLint, and a credential-free production build. No live payment
API calls or real database/customer reads are permitted during this task.

Before a separately authorized rollout: review the migration and retention
policy, test it on a disposable staging database, generate Prisma, inventory and
reconcile legacy provider references through a controlled approved process, and
then switch entitlement projection. The new schema alone does not validate old
customer mappings or reconstruct records that were previously overwritten.

Existing environment variables remain required for their respective providers:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`,
`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID`,
`LEMONSQUEEZY_PRO_VARIANT_ID`, and `NEXT_PUBLIC_APP_URL`. Review-account environment
overrides remain honored. No credentials will be public or embedded in builds.

## Approval requested

Approve the additive billing-state design above before application-code/schema
implementation. The SQL proposal is a concrete starting point, not an applied
migration. Table names and column details can be refined during implementation
within this approved scope; no major departure will be made without discussion.

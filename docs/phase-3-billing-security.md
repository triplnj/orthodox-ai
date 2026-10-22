# Phase 3 implementation and rollout

Local implementation only. No database migration, production/customer lookup,
or live payment-provider call was performed. The architecture proposal is retained
as the historical approval record; this document describes the implementation.

## Authoritative workflows

Both deletion endpoints use `billing/service.deleteAccount`. The settings URL
still requires `{ "confirmation": "DELETE" }`; the account URL remains bodyless.
Both protect the configured review accounts, case insensitively. The service
commits a deletion fence before making external requests. It inventories both
providers, including paginated customer subscriptions and stored historical IDs,
cancels subscriptions, inventories again, checks outstanding invoices, then
deletes the user in the local transaction. Any uncertainty retains the account,
sessions, and fence. Remote cancellations cannot be rolled back when a later
provider fails; retry inventories their actual state rather than charging again.

Both checkout endpoints share a per-user PostgreSQL advisory transaction lock
and a durable cross-provider attempt. A partial unique database index enforces
one CREATING/OPEN/UNKNOWN/PAID_OPEN attempt per user. Email verification is required.
Known subscription/customer identifiers are checked across providers; potentially
billable or unknown subscription states block another purchase. Stripe uses stable
customer/attempt idempotency keys. Lemon Squeezy is still the UI checkout provider;
its requests use the existing store, variant, redirect, and custom user metadata,
plus an attempt identifier and a 30-minute hosted-checkout expiration.

Lemon hosted checkouts are not assumed single-use. A payment webhook leaves its
attempt PAID_OPEN until provider-confirmed expiration/closure is reconciled.
Stripe's completed session is consumed and its attempt becomes COMPLETED. An
earlier webhook cannot cause the checkout response handler to reopen that attempt.
Opening the existing Lemon portal URL supports legacy Stripe subscribers. A
dual-provider account gets an explicit conflict; the Stripe-specific portal stays
available, and support must coordinate management of both providers.

## Webhook and entitlement integrity

Verify signatures first. Stripe events use the provider event ID; Lemon events
use SHA-256 of the signed body (do not trust an unsigned delivery-ID header).
Each receipt is unique per provider. Reusing an event ID with another payload
is rejected. Receipt completion, ledger mutation, and compatibility projections
are one transaction. Failed processing is not marked processed and can retry.

Current subscription state is retrieved while holding the same per-user lock
used for billing changes. Delayed snapshots are never directly applied. Lemon
resource update timestamps add a version guard; Stripe does not rely on event
timestamps. Equal-timestamp events still reconcile current state. Bind customer,
subscription, product, and user identity; custom user metadata alone cannot
establish a new association. A new association requires its durable checkout
attempt or a previously recorded provider/customer/subscription mapping. Null-user
ledger tombstones cannot be reassigned after account deletion.

PRO is projected from all verified provider subscriptions. One historical
cancellation cannot revoke a different active subscription. Stripe `trialing`
and Lemon `on_trial` grant access through the verified trial end. Scheduled
cancellation preserves access through the verified period, with no grace added.
Existing user billing IDs stay in place as compatibility references; an old
subscription event cannot overwrite a newer provider pointer. Existing plan/status
fields remain projections consumed by the current application.

## Bounded outage grace

Normal verified access ends at the provider's paid-period/trial boundary. When a
signed-in user's stored boundary expires, refresh provider inventory before
deciding entitlement. Only a controlled provider-unavailable response (503)
permits grace. Ownership/product conflicts, successful cancellation verification,
and arbitrary database/application exceptions do not activate grace.

Grace ends exactly **72 hours after the previously verified paid-period end**.
It requires an existing PRO/active projection and stored paid evidence from a
nonzero paid invoice. It never extends trials, scheduled cancellations, unverified
legacy rows, or FREE accounts. The extension is returned only for the current
request; it does not replace the original verification/boundary in the database.
Repeated outages cannot restart the deadline. A successful refresh immediately
uses current provider state. At the deadline, access expires even during an outage.

## Auditable recovery

Provision `BILLING_ADMIN_USER_IDS` as comma-separated immutable local user IDs.
The recovery service verifies the administrator's current database emailVerified
field and explicit ID membership on every call. No email-address role inference.
`POST /api/billing/recover` accepts authenticated JSON `{ userId, reason }`;
reason must contain 10–500 characters. Do not put secrets or customer PII in it.

1. A recovery request with actor ID, reason, and UTC timestamp is committed to
   the user's recovery log before provider verification. Failed recovery therefore
   leaves an audit record as well as its original fences.
2. Re-inventory current subscriptions across both providers. Provider failure or
   ambiguous ownership aborts recovery without clearing fences.
3. For every unresolved attempt, require its stored provider checkout ID and a
   fresh provider response proving closure: Stripe expired/complete; Lemon a
   provider-returned expiration already passed. A local expiresAt or elapsed
   timeout alone never qualifies. Record the successful evidence action on the
   attempt and mark it RECONCILED.
4. Re-project access and record DELETION_ABORTED with actor, reason, timestamp,
   and inventory count. Clear the deletion fence while retaining the account.
   Recovery never deletes the account or silently restarts checkout. The customer
   can then explicitly retry deletion or manage the verified existing subscription.

An uncertain attempt without a provider checkout ID cannot be force-cleared by
this endpoint. A correctly bound payment webhook can supply subscription state,
but cannot prove an unknown hosted link unusable. Escalate to a separately
authorized provider investigation, preserve the fence, and prepare an auditable
data repair only after independent provider evidence identifies and closes that
exact attempt. There is deliberately no timeout override or unverified reset.

Interrupted deletion may also be retried directly by the customer. Cancellation
and verification repeat against current provider state; no timer automatically
deletes the account or lifts the fence. An administrator may instead abandon
deletion using the recovery procedure, leaving the account and billing intact.

## Minimal local billing retention

Purpose: webhook replay/ownership protection, prevention of orphan billing,
investigation of failed cancellation/duplicate checkout, and recovery audit.
Provider accounting/payment records remain with the providers; this change does
not delete payment history or create a local copy of card/invoice/customer profiles.

On account deletion, subscription/attempt user references become NULL through
SET NULL foreign keys. Retain only provider subscription/customer/product IDs,
status/period/verification evidence, attempt ID/status/provider checkout ID,
timestamps, and recovery evidence. Hosted checkout URLs are cleared. Emails,
names, app content, sessions, and the user-level recovery log are deleted with
the user. No webhook bodies, card details, signing secrets, or API keys are stored;
receipts retain only their digest, event identity/type, subscription reference,
processing state and timestamps. Recovery reasons must exclude personal data.

Set orphaned subscription/attempt retainedUntil to deletion time plus **90 days**.
After that date, a separately authorized maintenance operation may delete them
only when userId IS NULL, provider cancellation/closure has been verified, no
unresolved attempt/payment/incident exists, and no documented legal hold applies.
Processed webhook receipts may be removed 90 days after processedAt only after
checking the same unresolved-incident/hold criteria. Do not delete unprocessed
receipts or unresolved fences based on age. Existing linked billing records stay
while the account exists. Review unresolved cases at least every 30 days; do not
retain them indefinitely without a documented reason and next review date.

No automatic purge is enabled in this phase: externally held incident/legal-hold
evidence cannot safely be inferred by an automatic age-only SQL delete. Deployment
must assign a maintenance owner and a reviewed, logged purge process. Provider
retention and statutory accounting obligations require a separate business policy.

## Migration and environment requirements

Prepared, **not executed**:
`prisma/migrations/20261018000000_billing_integrity/migration.sql`.
It adds three billing tables and nullable user deletion/recovery/access/grace
fields, SET NULL relations, unique receipt/subscription keys, and the partial
pending-attempt index. All existing user fields, provider IDs and plans remain.
Legacy Stripe and Lemon references are seeded as unverified_legacy with a snapshot
of the ambiguous old shared status. No guessed provider entitlement is backfilled.
The proposal-only SQL under proposed-migrations is historical and must not be run.

Before any separately authorized deployment:

1. Back up and test the migration against a disposable staging copy with synthetic
   data. Check conflicting existing provider/subscription ownership. A uniqueness
   conflict must stop rollout; never discard a row with ON CONFLICT or guess owner.
2. Apply the additive migration through the normal reviewed deployment process,
   then run `prisma generate` and build. New code requires the new schema.
3. Reconcile existing provider identifiers using an approved controlled process
   (the admin recovery operation can inventory a mapped individual account).
   Local task tests use mocks only. Missing overwritten historical references
   cannot be reconstructed from the migration; investigate them separately.
4. Verify real provider response contracts, invoice filtering/pagination, historic
   price/variant compatibility, and webhook subscriptions in provider test mode
   before production rollout. This task makes no live compatibility claim.
5. Review access snapshots and reconcile ALL legacy rows before considering the
   entitlement cutover complete. During partial reconciliation, an unverified
   other-provider row preserves existing legacy PRO instead of forcing a downgrade;
   it cannot produce a new PRO grant. This transitional preservation has no
   automatic provider-outage grace and must not become permanent stale access.
6. Provision recovery administrators, assign retention ownership, monitor webhook
   failures/fences, and rehearse partial cancellation and outage recovery.

Existing environment variables remain: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRO_PRICE_ID, LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_WEBHOOK_SECRET,
LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_PRO_VARIANT_ID, NEXT_PUBLIC_APP_URL, and existing
review-account overrides. New optional administrative configuration:
BILLING_ADMIN_USER_IDS (empty means nobody can invoke recovery).
No billing credentials are required during module import/build analysis.

## Verification scope and residual limits

Mock tests execute real services, routes, and provider adapters. They cover
activation/renewal/trials, cancellation, replay/delayed/equal-timestamp events,
cross-provider and concurrent checkout, rollback, grace boundaries, deletion
failure/partial cancellation/invoices, review accounts, recovery authorization,
and hosted-link closure. They do not replace PostgreSQL integration testing of
the advisory lock/index, provider sandbox contract testing, or staged legacy
reconciliation. Long provider inventories can exceed the transaction deadline;
those operations fail closed. Local locking cannot stop purchases made directly
outside the app, and a hosted Lemon link may remain usable until provider expiry.

## Changed-file manifest

Modified application/schema/tests:

- prisma/schema.prisma
- src/app/api/account/delete/route.ts
- src/app/api/account/route.ts
- src/app/api/settings/delete/route.ts
- src/app/api/lemonsqueezy/create-checkout/route.ts
- src/app/api/lemonsqueezy/customer-portal/route.ts
- src/app/api/lemonsqueezy/webhook/route.ts
- src/app/api/stripe/create-checkout-session/route.ts
- src/app/api/stripe/customer-portal/route.ts
- src/app/api/stripe/webhook/route.ts
- src/lib/auth.ts
- src/lib/subscription.ts
- tests/stripe-initialization.test.mjs

New implementation files:

- prisma/migrations/20261018000000_billing_integrity/migration.sql
- src/app/api/billing/recover/route.ts
- src/lib/billing/http.ts
- src/lib/billing/providers.ts
- src/lib/billing/service.ts
- tests/phase3-billing.test.mjs
- tests/run-regressions.mjs
- docs/phase-3-billing-security.md

Already prepared during the proposal review, still untracked and unchanged by
implementation: docs/phase-3-billing-proposal.md and
prisma/proposed-migrations/phase-3-billing-integrity.sql.
Generated Prisma client files were regenerated locally and remain Git-ignored.

## Regression results

| Suite | Passed | Failed | Cancelled | Skipped |
| --- | ---: | ---: | ---: | ---: |
| blog-security | 33 | 0 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 | 0 |
| phase2-security | 45 | 0 | 0 | 0 |
| phase3-billing | 66 | 0 | 0 | 0 |
| Total | 192 | 0 | 0 | 0 |

The full run passed with 65 billing tests; the final billing-only rerun passed
all 66 after adding legacy-trial lazy reconciliation. Each isolated suite uses
one worker, a 30-second test timeout, and a 60-second process deadline. Mocked
infrastructure only; no production database or live provider calls. Initial
sandbox execution could not start the isolated worker (`spawn EPERM`); approved
execution outside that process restriction passed. No assertion failures remain.

Final checks: `tsc --noEmit` exit 0, ESLint exit 0 (0 errors; 1 existing unused
eslint-disable warning in the generated workflow route), and credential-free
`next build` exit 0 with all 81 pages generated. OpenAI, Stripe, Lemon Squeezy,
and database environment credentials were removed for the build; no local .env
files were present. Installed Next.js reported version 16.3.4. The build also
warned about an ignored package-lock.json outside this repository; it was not
modified. The initial sandbox build returned spawn EPERM; the approved worker
execution passed. Prisma client generation succeeded locally; SQL was not run.

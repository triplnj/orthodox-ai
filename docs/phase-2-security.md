# Phase 2: AI admission and internal research security

## Architecture and scope

All ten `/api/patristics` handlers and six existing admin maintenance handlers
use `secureResearchRoute`. Research requires either the existing
`x-patristics-secret` worker credential or a database-verified user explicitly
provisioned by immutable ID in server-only `PATRISTICS_ADMIN_USER_IDS`.
Ordinary Free/Pro users cannot invoke these operations. Worker secret comparison
uses constant-time comparison of hashes. Existing secret-header integrations
remain supported, including maintenance requests without JSON bodies.

All nine `*-test` routes return 404 in production unless
`ENABLE_PATRISTICS_TEST_ROUTES=true`. Enabling the switch does not bypass
authorization, input limits, or admission limits. Prefer the production-safe
`POST /api/admin/patristics/jobs` endpoint for queued discovery. It accepts
`{ "query": "...", "language": "en" }` to enqueue and dispatch, or
`{ "jobId": "..." }` to dispatch an existing pending job. The non-test
`discover-background` and existing admin maintenance routes remain available to
authorized callers.

Normal chat retains all its patristic providers and source-grounding behavior.
Prompts, model selections, verification requirements, and billing logic are
unchanged.

## Atomic reservations and limits

`AiReservation` records admission before expensive work. A short PostgreSQL
transaction takes a transaction-scoped advisory lock per principal, checks
capacity, and inserts the reservation. Explicit Read Committed isolation makes
counts see preceding committed reservations after waiting for the lock. The
transaction does not include model calls, research, or workflow execution.

Chat also inserts its existing `UsageLog` record in the same transaction. This
retains previous usage, prevents migration from resetting chat quotas, and keeps
existing account usage queries working. The old count-then-log path is no longer
used for admission. Denials do not create reservations or invoke research/AI.

Limits are server-side defaults:

| Scope | Limit |
| --- | --- |
| Free chat | Existing 5 attempts per day |
| Active Pro chat | Existing 100 attempts per day |
| Prayer, fasting, Scripture plans and journal summaries | Active Pro required; 30 combined attempts per day |
| All admitted operations for a principal | 10 starts per minute, one active operation |
| Token-based review chat | 100 attempts per day under one stable shared principal |
| Each review-session entry route | 100 starts/day, 10/minute, one active request per shared entry principal |
| Internal research | 30 admitted HTTP operations/day per configured admin or shared worker principal |

Existing subscription interpretation and the server's existing midnight boundary
are preserved. Rate/concurrency failures return 429 rather than suggesting an
upgrade. Only Free chat daily exhaustion and paid-feature entitlement failures
set `upgradeRequired`.

Reservations finish in `finally` on success/failure. Failed attempts remain
charged because providers may have performed billable work before an error.
Five-minute concurrency leases are refreshed every 30 seconds during an active
request. Timers are created only during execution, unref'ed, and cleared after
completion. Expired leases permit recovery after a process crash. Bodies are
bounded to 64 KiB, individual AI fields to 20,000 characters, research queries
to 2,000 characters, and journal summary input to 40,000 characters.

## Job ownership and dispatch

Enqueueing the same normalized query/language is serialized in PostgreSQL.
Dispatch conditionally writes `dispatchedAt` once before calling the existing
Workflow SDK `start()` function. Competing dispatches return 409.

Both direct processing and durable workflow processing claim a job by atomic
conditional update from `PENDING` with no owner to `PROCESSING` with an owner.
The direct processor uses a fresh random owner; the workflow uses its durable
run ID. Only the same workflow run can resume its processing claim after a
step retry. Completion/failure updates are fenced by owner and status. A loser
cannot mark the winner's work completed or failed. Existing quote/source data
and the research pipeline stages are unchanged.

Ambiguous dispatch failures retain the dispatch fence. Failed jobs and orphaned
processing claims are not automatically reset: inspect workflow state and
confirm no worker is active before an authorized operator recovers a job.
Never blindly clear a claim while its owner might still execute.

## Deployment procedure (not performed)

1. Quiesce internal job submission and drain existing workflow/direct processing
   jobs before switching application versions. Existing `PROCESSING` records
   have no new ownership token and cannot safely be adopted automatically.
2. Back up and review the additive migration
   `20261017000000_ai_reservations_and_job_claims`. It adds one table, two job
   fields, and supporting indexes; it does not rewrite research or usage data.
3. Apply the reviewed migration through the normal authorized deployment
   process before serving the new code. Index creation can lock the usage table;
   plan the migration window for the dataset's size. No migration was run by
   this implementation task. Missing tables/fields cause admission to fail
   closed with controlled errors rather than permitting unmetered work.
4. Generate the Prisma client in the build process. Configure the worker secret
   and/or verified research admin IDs server-side. Leave test routes disabled
   in production unless deliberately needed. Runtime AI/billing credentials
   retain their existing configuration.
5. Verify staging behavior with a disposable database before production:
   simultaneous admission, job ownership, lease renewal, and migration rollout.

## Verification and remaining limits

Regression tests use the real handlers and helpers with an in-memory transaction
model, mocked AI/workflow calls, and blocked network fetches. They cover existing
Free/Pro rules, every research API's rejection of ordinary users, production
test-route behavior, simultaneous requests, quota exhaustion, failed operations,
rollback, duplicate enqueue/dispatch/claim, and workflow ownership. They do not
prove PostgreSQL lock behavior or deployment transport end-to-end; that needs
an isolated staging database. No production database, migrations, or live AI
requests were used.

These are per-principal request budgets, not a global monetary/token cap.
Multiple accounts and variable-cost research can still increase total spend.
Trusted maintenance operations can process many quotations in one admission;
privileged operators must use them deliberately. Async jobs are fenced per job;
the HTTP admission lease covers submission, not the entire durable run.

A prolonged process pause or database partition exceeding the lease can allow
overlap after expiry. Heartbeats reduce this risk but do not provide a strict
distributed concurrency guarantee during partitions. Provider calls inside a
retried workflow step remain at-least-once if a crash occurs after the provider
accepted work but before the step result was persisted. Claims prevent competing
job owners; they cannot guarantee exactly-once external billing.

Review links are shared bearer credentials, so their quotas are shared rather
than individual-human quotas. Reservation records contain principal/feature/
timing/status metadata, not request content; add an operational retention policy
for old records. General auth hardening, SSRF protection for privileged source
collection, and issues outside findings 3/4/5/14 remain separate work.

## Complete Phase 2 file manifest

Modified files (30):

```text
package.json
prisma/schema.prisma
src/app/api/admin/patristics/backfill-translations/route.ts
src/app/api/admin/patristics/collect/route.ts
src/app/api/admin/patristics/discover/route.ts
src/app/api/admin/patristics/embed/route.ts
src/app/api/admin/patristics/repair/route.ts
src/app/api/admin/patristics/verify/route.ts
src/app/api/chat/route.ts
src/app/api/journal/summarize/route.ts
src/app/api/patristics/discover-background/route.ts
src/app/api/patristics/enqueue-test/route.ts
src/app/api/patristics/pg-clean-test/route.ts
src/app/api/patristics/pg-general-test/route.ts
src/app/api/patristics/pg-search-test/route.ts
src/app/api/patristics/pg-translate-test/route.ts
src/app/api/patristics/pg-verify-clean-test/route.ts
src/app/api/patristics/pg-witness-test/route.ts
src/app/api/patristics/process-job-test/route.ts
src/app/api/patristics/start-workflow-test/route.ts
src/app/api/pro/fasting-plan/route.ts
src/app/api/pro/prayer-plan/route.ts
src/app/api/pro/scripture-plan/route.ts
src/app/api/review/chat/route.ts
src/app/api/review/clergy/start/route.ts
src/app/api/review/fr-josiah/start/route.ts
src/lib/patristics/enqueue-discovery.ts
src/lib/patristics/process-discovery-job.ts
src/workflows/patristic-discovery.ts
tests/openai-initialization.test.mjs
```

New files (10):

```text
docs/phase-2-security.md
prisma/migrations/20261017000000_ai_reservations_and_job_claims/migration.sql
src/app/api/admin/patristics/jobs/route.ts
src/lib/ai/operationLimits.ts
src/lib/ai/requestSecurity.ts
src/lib/ai/secureRoute.ts
src/lib/patristics/api-security.ts
src/lib/patristics/dispatch-job.ts
src/lib/patristics/job-claims.ts
tests/phase2-security.test.mjs
```

Prisma client code was regenerated locally under the existing ignored generated
directory. No schema changes were applied to any database.

## Final local results

- Regression suites: 126 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo;
  runner duration 8008.0941 ms (8069 ms overall). This includes 45 Phase 2,
  33 blog, 21 OpenAI initialization, and 27 Stripe initialization tests.
- Tests used process isolation, one worker, 30-second per-test timeouts, and
  a 90-second outer deadline. No timeout occurred.
- Full TypeScript check: exit 0, no diagnostics.
- Repository-wide ESLint: exit 0, 0 errors, 1 existing unused-disable warning
  in generated workflow code.
- Credential-free production build: exit 0; compilation 7.9s, build TypeScript
  9.8s, page generation 80/80 in 965ms. The existing warning about an ignored
  parent-directory lockfile remains.
- `git diff --check`: passed. No commits, pushes, or deployments performed.

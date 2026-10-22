# Phase 8 bounded reconciliation and private-data diagnostics

Local implementation only. No migration execution, native database access, provider calls, infrastructure changes, commit or deployment is authorized by this work. The mass logging transformer is abandoned; its candidate diff was reference material only. All 86 sites were changed by explicit source patches after reviewing their arguments.

## Entitlement contract

`User.legacyReconciliationDeadlineAt DateTime? @db.Timestamp(3)` is a cutover marker, **not payment verification**. Runtime access requires the preserved pre-cutover active-PRO snapshot, no previously finite billing deadline, no deletion fence, no verified subscription evidence, an actually unresolved provider inventory with a subscription/customer reference, a future cutover deadline, and no known terminal state or ownership collision. FREE accounts, new accounts, email matches, a deadline alone and healthy empty inventories cannot obtain legacy access.

Provider reconciliation is independent for read access. A verified active subscription or trial can preserve access when the other provider is unavailable or conflicted. The conflicted provider cannot support a grant. Local customer/subscription ownership collisions are checked before remote reads so an outage cannot hide them. Unknown/database errors fail with a controlled unavailable response, never raw stored PRO. Sensitive billing writes retain strict complete inventory reconciliation, durable checkout/deletion fences, receipts, recovery evidence and provider-aware cancellation. Prices and provider selection are unchanged.

Verified subscription/trial deadlines take precedence over legacy markers. Paid-through cancellation does not receive outage grace. Previously verified paid active, non-cancelling records retain the existing grace of original paid-through deadline plus 72 hours **only during that provider's outage**. Neither grace is renewed by a login, request, restart or outage. Read-time legacy/grace projections are not persisted as new verified payment deadlines.

Review access requires explicit `REVIEW_USER_ID`/`REVIEW_CLERGY_USER_ID` bindings, matching configured email, verified passwordless dedicated state, and no billing references/deadlines/deletion fence. The service also rejects review exemptions if billing rows or checkout attempts exist. Email-based prohibitions on billing writes remain protective restrictions, not entitlement grants. Existing review transition/session/token protections remain in place.

The account, profile, history and dashboard APIs use effective entitlements. `isProUser` requires active PRO with a future effective deadline or the server-owned review projection; raw indefinite PRO snapshots no longer suffice. Quota values, atomic reservation rules, models and grounding checks are unchanged.

## Additive migration and controlled cutover

Prepared file: `prisma/migrations/20261021000000_bounded_legacy_reconciliation/migration.sql`. No other migration is changed by this correction.

Prepared SQL SHA-256: `a2852001bb5e375e88c1cd125006fd2b061d86f729c53b0defece34fb311e344`. Preserve UTF-8 without BOM and verify exact artifact bytes at deployment; local Git warns that automatic LF/CRLF conversion can occur on future Git operations. No Git configuration or migration line endings were changed to suppress that warning.

The transaction adds one nullable `TIMESTAMP(3)` column. One database `clock_timestamp()` call, explicitly converted to UTC, establishes a common cutover and deadline 72 hours later for preexisting active-PRO snapshots with no finite billing deadline. The migration changes no plan/status, provider record, payment history or billing recovery evidence. It emits only cutover, deadline and candidate count, not identities.

**Schema limitation:** those historical snapshots do not prove payment or uniquely distinguish legitimate legacy accounts from every stale/invalid account. Backfilled values mark candidates only. The conservative runtime checks above remain mandatory, including rejection of cancellations, conflicts and invalid verified evidence. Operators must reconcile uncertain records through existing verified-provider procedures. A missing verified ledger cannot be repaired by extending a legacy deadline.

The trigger rejects non-null deadlines on INSERT and any deadline change on UPDATE, including NULL-to-value, extension, reduction and clearing. Unrelated legitimate reconciliation updates may retain the same value. Account DELETE remains possible through the existing billing-safe workflow; recreating a user cannot restore a legacy deadline. Runtime code never updates this field.

Production procedure, requiring separate deployment authorization:

1. Rehearse this new migration and an upgrade from representative synthetic snapshots on an isolated native database. Review backups and restore procedures. The earlier successful 17-migration rehearsal predates this eighteenth migration.
2. Build the new artifact and generate its Prisma client from the updated schema before the maintenance window. Do not release it against the old schema.
3. Pause registration, billing writes/webhooks, review provisioning and other sensitive user writes; queue provider events for later verified replay. Drain old web/worker/workflow processes completely. Do not allow old code to run against the new marker/entitlement policy.
4. With writes still paused, apply the additive migration immediately before coordinated application cutover. Record the emitted UTC cutover/deadline, migration SHA-256 and Prisma migration receipt in the restricted deployment record.
5. Start only the coordinated new application/workers, verify effective access and review configuration, then resume queued verified webhooks and sensitive writes.
6. If rollout is delayed or fails after migration commit, the existing deadline continues to age. **Never rerun a backfill, edit the marker, drop the trigger or change clocks to obtain another window.** If the transaction rolled back, do not serve the new application until the migration is applied under a new explicitly authorized maintenance cutover. Resolve an uncertain Prisma receipt against database evidence before any retry; do not stamp it applied or rerun SQL speculatively.

`TIMESTAMP(3)` stores UTC wall-clock values without an embedded offset, matching the Prisma annotation. `SET LOCAL TIME ZONE 'UTC'` plus `AT TIME ZONE 'UTC'` makes this backfill unambiguous independent of the cluster's timezone. The installed Prisma PG adapter normalizes timestamp-without-time-zone values by appending `+00:00`; JavaScript serialization uses ISO UTC. This does not reinterpret old accounting timestamps or change `AI_QUOTA_TIMEZONE`. Native Prisma round-trip/timezone verification remains a release gate.

## Diagnostics and retention

`src/lib/diagnostics.ts` is server-only. Runtime validation admits only fixed event/operation/outcome/failure enums, generated or validated UUID correlation IDs, timestamps, HTTP status and bounded nonnegative integer counts/durations. Unknown fields, user IDs, URLs, tokens, queries, journal/chat text, passages, provider bodies, arbitrary exceptions, messages, causes and stacks are omitted. Accessor values and `toJSON` are not invoked. Sink failures are contained.

Prisma routine SQL logging is disabled. OpenAI SDK logging is explicitly `off`, including when `OPENAI_LOG` requests debug output. Production rejects nonempty `DEBUG` and `NODE_DEBUG` before Prisma/client initialization; operators must remove unsafe dependency debug flags. This changes observability, not request/provider behavior, model selection, retries or timeouts.

Research failures are persisted as fixed `RESEARCH_*` categories at the final claim-fenced write boundary. Worker rethrows and source verification/repair failure metadata are sanitized. Research test/repair HTTP handlers no longer return raw exception messages. Success payloads and source-grounding decisions remain unchanged.

Proposed operational diagnostic retention is **seven days from ingestion**, automatically deleted afterward. Its purpose is short-term availability, latency, error-category and abuse diagnosis. Restrict log access and exports; do not copy payloads into incident notes. Application redaction does not configure or prove external retention. Hosting logs, drains, APM, reverse-proxy access logs, error collection, exports and their backup retention require separate operational configuration and verification. Disable request-body capture and redact sensitive URL query strings/review links there. No external settings were changed locally.

Existing private-response cache retention (seven days), user-owned journal/conversation history and billing retention (90 days under its existing deletion criteria) remain separate and unchanged. Legacy research-job errors and historical logs may already contain private content. An authorized operator must assess and remove/redact that historical diagnostic data without deleting jobs, claims, source records, payment history or recovery evidence. This implementation prevents new unsafe diagnostic writes; it does not retroactively clean production.

## Individually reviewed blocked calls

Locations below refer to the pre-edit audit; current line numbers differ. There were 36 blocked calls, with no business mutations in their arguments.

| File | Original lines | Direct correction |
| --- | --- | --- |
| `src/app/api/patristics/discover-background/route.ts` | 43 | Keep completed discovery and bounded saved count; drop query/IDs/results. |
| `src/lib/ai/operationLimits.ts` | 88 | Retain promise rejection handler, emit fixed heartbeat/database event. |
| `src/lib/patristics/backfill-translations.ts` | 141 | Replace quote-ID interpolation/error object with failure category. |
| `src/lib/patristics/build-chat-context.ts` | 119 | Remove diagnostic-only metadata mapping; keep usable quote count. |
| `src/lib/patristics/build-patristic-research-context.ts` | 306 | Keep bounded source count; drop query and provider payloads. |
| `src/lib/patristics/collect.ts` | 46 | Keep rejection branch and skip event; drop quotation. |
| `src/lib/patristics/discover-and-save.ts` | 170, 222, 307, 325 | Remove diagnostic-only serialization/maps; keep verification count and skip events. Extraction, verification, saves and filter returns are unchanged. |
| `src/lib/patristics/embed-quotes.ts` | 84 | Keep failure branch/counter; drop quote ID/raw exception. |
| `src/lib/patristics/pg-passage-search.ts` | 371, 407, 439, 471, 498, 520, 546, 746 | Drop routing/search/source payloads, conversion and diagnostic sample mapping; preserve bounded counts, `Date.now()` duration, timeout break and error continues. |
| `src/lib/patristics/search-curated-texts.ts` | 276, 433 | Drop terms/query/source/error payloads, retain retrieval events/category. |
| `src/lib/patristics/verify-discovery.ts` | 38 | Remove URL parsing IIFE used only for hostname logging; trusted-source lookup, fetching and exact matching remain. |
| `src/lib/patristics/verify-second-source.ts` | 407, 496, 542, 709 | Retain failures/continues/grounding decisions; drop IDs, URLs, message conversion and diagnostic-only confidence formatting. The actual confidence normalization remains in the grounding check. |
| `src/lib/patristics/web-discovery.ts` | 32 | Keep disabled-provider skip and empty return; omit request payload. |
| `src/workflows/patristic-discovery.ts` | 266, 375, 398, 428, 458, 513, 532, 582, 630 | Keep actual workflow work, saves, returns, skips and errors; retain only bounded counts/categories. |

The remaining 50 calls were also reviewed and patched directly. No transformer/apply command was executed. Raw exceptions are classified without executing arbitrary `toString`/message getters; their diagnostic-only evaluation is intentionally removed, not preserved as an unsafe hidden side effect.

## Native PostgreSQL verification plan — not executed

Requires separate authorization because it executes the new migration. Use only a new synthetic disposable database on an identity-verified temporary instance; verify address, port, directory, PID, version and start time before creation and all destructive operations. Verify the disposable database OID and name before deletion. Preserve migration SHA-256 hashes, original errors, individual failures and cleanup status separately; guarantee cleanup attempts with `finally`. Any test/migration/hash/cleanup failure must produce a failing exit status.

* Apply the 17 historical migrations in order; seed eligible legacy PRO, FREE/new users, cancellations, no-reference accounts, finite verified subscriptions, trials, dual providers, ownership collisions and dedicated review fixtures. Apply migration 18 exactly once. Assert no plan/status/evidence/history changes and one common deadline exactly cutover plus 72 hours.
* Verify all trigger cases: INSERT omitted/NULL permitted; INSERT non-null rejected; UPDATE unchanged allowed; NULL-to-value, extension, reduction and clear rejected; unrelated billing updates and webhook writes permitted; DELETE permitted after the authoritative billing workflow. DELETE/recreate cannot revive marker. Check rollback leaves original rows unchanged.
* Use multiple independent connections and barriers for simultaneous deadline changes, normal billing updates, deletion and stale updates; assert no extension/claim transfer, transaction atomicity and expected blocking/error outcomes.
* Use real Prisma queries to serialize UTC timestamps in UTC, Europe/Berlin (including DST boundaries) and another session timezone; assert identical intended deadline instants with millisecond precision. Do not change quota reset configuration.
* Simulate delayed cutover, worker restart, provider outage, verified renewal/trial/cancellation, conflicting ownership and interrupted migration receipt. Confirm no silent extension and no unverified new PRO. Billing provider functions remain mocked; no live services.
* Confirm migration hashes are unchanged and the new disposable database is deleted. Never run the existing native suite unchanged: it discovers migrations and would apply migration 18, which remains unauthorized here.

## Changed-file manifest for this correction

This manifest includes the already prepared billing/privacy work completed in this task, not unrelated modifications from Phases 1–7 or the prior review-account fix.

```text
prisma/schema.prisma
prisma/migrations/20261021000000_bounded_legacy_reconciliation/migration.sql
src/lib/diagnostics.ts
src/lib/billing/entitlements.ts
src/lib/billing/service.ts
src/lib/subscription.ts
src/lib/auth.ts
src/lib/prisma.ts
src/lib/ai/openaiClient.ts
src/lib/ai/operationLimits.ts
src/lib/ai/secureRoute.ts
src/lib/security/auth-http.ts
src/lib/security/review-provisioning.ts
src/lib/patristics/backfill-translations.ts
src/lib/patristics/build-chat-context.ts
src/lib/patristics/build-live-pg-chat-context.ts
src/lib/patristics/build-patristic-research-context.ts
src/lib/patristics/collect.ts
src/lib/patristics/discover-and-save.ts
src/lib/patristics/embed-quotes.ts
src/lib/patristics/pg-passage-search.ts
src/lib/patristics/search-curated-texts.ts
src/lib/patristics/verify-discovery.ts
src/lib/patristics/verify-second-source.ts
src/lib/patristics/verify-attribution.ts
src/lib/patristics/repair-corrupted-quotes.ts
src/lib/patristics/web-discovery.ts
src/lib/patristics/job-claims.ts
src/lib/patristics/process-discovery-job.ts
src/workflows/patristic-discovery.ts
src/app/api/account/route.ts
src/app/api/dashboard/route.ts
src/app/api/history/route.ts
src/app/api/journal/route.ts
src/app/api/journal/summarize/route.ts
src/app/api/onboarding/route.ts
src/app/api/chat/route.ts
src/app/api/settings/profile/route.ts
src/app/api/settings/export/route.ts
src/app/api/pro/fasting-plan/route.ts
src/app/api/pro/prayer-plan/route.ts
src/app/api/pro/scripture-plan/route.ts
src/app/api/review/chat/route.ts
src/app/api/review/clergy/start/route.ts
src/app/api/review/fr-josiah/start/route.ts
src/app/api/admin/patristics/backfill-translations/route.ts
src/app/api/admin/patristics/collect/route.ts
src/app/api/admin/patristics/discover/route.ts
src/app/api/admin/patristics/embed/route.ts
src/app/api/admin/patristics/repair/route.ts
src/app/api/admin/patristics/verify/route.ts
src/app/api/patristics/discover-background/route.ts
src/app/api/patristics/pg-clean-test/route.ts
src/app/api/patristics/pg-general-test/route.ts
src/app/api/patristics/pg-search-test/route.ts
src/app/api/patristics/pg-translate-test/route.ts
src/app/api/patristics/pg-verify-clean-test/route.ts
src/app/api/patristics/pg-witness-test/route.ts
src/app/api/patristics/process-job-test/route.ts
tests/phase2-security.test.mjs
tests/openai-initialization.test.mjs
tests/phase3-billing.test.mjs
tests/phase5-conversations.test.mjs
tests/phase7-ui.test.mjs
tests/helpers/phase6-harness.mjs
tests/phase8-privacy-legacy.test.mjs
tests/run-regressions.mjs
docs/phase-8-billing-privacy.md
docs/phase-8-readiness.md
docs/phase-8-environment.md
```

Earlier-phase PRO fixtures now supply finite server-verified entitlement projections; no quota limits or test boundaries were relaxed. Exact final test/build results are recorded after verification.

## Final regression results

The final complete runner exited 0 after the Web Crypto compatibility correction. Each suite used process isolation, one worker, a 30-second per-test timeout and 60-second process deadline. Credentials were removed by the runner and live service boundaries were mocked.

| Suite | Passed | Failed | Skipped | Cancelled | Exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| blog-security | 33 | 0 | 0 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 | 0 | 0 |
| phase2-security | 45 | 0 | 0 | 0 | 0 |
| phase3-billing | 73 | 0 | 0 | 0 | 0 |
| phase4-auth | 51 | 0 | 0 | 0 | 0 |
| phase4-ssrf | 69 | 0 | 0 | 0 | 0 |
| phase5-conversations | 52 | 0 | 0 | 0 | 0 |
| phase6-api | 36 | 0 | 0 | 0 | 0 |
| phase6-retries | 18 | 0 | 0 | 0 | 0 |
| phase6-postgres (in-memory SQL contracts) | 57 | 0 | 0 | 0 | 0 |
| phase6-frontend | 9 | 0 | 0 | 0 | 0 |
| phase7-ui | 36 | 0 | 0 | 0 | 0 |
| phase8-review-security | 44 | 0 | 0 | 0 | 0 |
| phase8-privacy-legacy | 53 | 0 | 0 | 0 | 0 |
| **Total** | **624** | **0** | **0** | **0** | **0** |

Local full output: `%TEMP%/orthodox-phase8-final-regressions.log`. The native `phase8-postgres` suite was **not run**, because it applies migrations. The previously successful native 31-test suite and 17-migration rehearsal are historical results, not validation of migration 18 or today's implementation. No application migration was applied here; the existing PGlite suite builds only its isolated in-memory SQL contract fixture.

Intermediate failures are retained explicitly: the first focused run passed 118 and failed 1, exposing an actual legacy-marker precedence bug; verified evidence now takes precedence. The first complete run passed 617 and failed 5 due to outdated SDK-option/raw-error/indefinite-PRO expectations; those assertions were corrected and a finite verified-PRO positive case added. Initial ESLint caught a new test variable named `module`, which was renamed. Default Prisma validation attempted a blocked engine download; offline validation using the already installed matching engine succeeded, and Prisma Client 7.8.0 was generated locally without database access or dependency installation. The first build caught a Node-only crypto import in a workflow bundle; the helper now uses guarded Web Crypto.

### Final verification status and execution blocker

* Complete final regression run: **624 passed, 0 failed, 0 skipped, 0 cancelled; exit 0**.
* TypeScript: standalone check passed (exit 0); the subsequent build also completed its TypeScript stage after the final Web Crypto change.
* ESLint: last completed run exited 0 with 0 errors and one existing unused-disable warning in generated `src/app/.well-known/workflow/v1/flow/route.js`. It preceded the last Web Crypto/helper-test adjustment; no further command was run after the approval rejection below.
* Prisma validation: passed offline using the installed schema engine matching commit `3c6e192761c0362d496ed980de936e2f3cebcd3a`; client generation passed. No engine/dependency installation was needed.
* Latest completed credential-free production build: **exit 1**. Workflow bundling succeeded (12 steps, one workflow), compilation succeeded in 23.2 seconds and TypeScript in 15.7 seconds. Page-data collection then failed for `/_not-found` because inherited nonempty `DEBUG` triggered `Verbose dependency diagnostics are disabled in production.` The production privacy guard remains intact.
* A process-local clean-environment build rerun, additionally clearing `DEBUG`/`NODE_DEBUG`, **did not execute**: execution approval returned `Rejected("rejected by user")`. No retry or repeated approval request was made. Final clean-environment build verification remains blocked; no success is claimed.
* `git diff --check` found no whitespace errors; Git emitted existing LF/CRLF warnings. All 70 manifest paths exist and are unique. The regenerated Prisma client is an ignored build artifact under `src/generated/prisma`, separate from the 70-file source/test/document manifest.

**NO-GO remains.** Required actions are an authorized clean-environment build/final lint check, separately authorized native verification of migration 18 and its trigger/concurrency/UTC behavior, coordinated cutover with writes paused and old workers drained, resolution of uncertain legacy ownership before the fixed deadline, completion of existing review-account transitions before enabling their links, and external seven-day log retention/historical private-log remediation. Earlier operational backup/restore, environment and manual accessibility gates remain unverified; none were changed or investigated further here. No production data, existing application database or live provider was accessed. No application migration, commit, push or deployment occurred.

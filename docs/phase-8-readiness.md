# Phase 8 readiness report — NO-GO

## Latest bounded-billing/privacy correction

The bounded legacy reconciliation and content-free diagnostics implementation supersedes the old billing/logging findings below. See `phase-8-billing-privacy.md` for implementation, all changed files, the unapplied eighteenth migration, the controlled-cutover procedure, diagnostic retention and the native verification plan. Historical test counts below predate this correction and must not be represented as its current verification. Native migration/trigger/concurrency/UTC round-trip tests remain unexecuted under the explicit no-migration restriction. Deployment, review transition, external retention and upgrade/restore gates still require separate operational completion; overall NO-GO remains.

Final local regression run: **624 passed, 0 failed, 0 skipped, 0 cancelled; exit 0**. TypeScript and offline Prisma validation passed. Last ESLint run passed with one existing generated-file warning, before the final small Web Crypto helper/test adjustment. Latest completed build compiled and passed TypeScript but failed page-data collection because inherited `DEBUG` was rejected by the production privacy guard. The clean-environment rerun was rejected by execution approval (`rejected by user`) and did not execute; work stopped without retrying. Final clean-environment build and final lint confirmation therefore remain outstanding. The earlier BOM correction, complete 17-migration rehearsal and native review-security results are historical successful checks; the new eighteenth migration has not been executed.

## Current status after authorized follow-up work

This addendum supersedes the initial blocker/test status retained below as historical audit evidence. The billing migration's leading three BOM bytes were removed with explicit approval; all other bytes were preserved. The full Prisma migration-engine rehearsal subsequently applied all 17 migrations including pgvector, with seven integration/integrity checks passing and each disposable rehearsal database deleted. The migration-chain blocker is resolved locally.

The review-account preclaim remediation is now implemented locally using explicit server-side user-ID bindings and collision-safe provisioning. Final verification: **594 passed, 0 failed, 0 skipped, 0 cancelled** across all prior regression suites, the 44-case review-security suite and the 31-case native PostgreSQL suite. TypeScript, ESLint (one existing warning), Prisma validation and credential-free production build (87/87 pages) passed. See `phase-8-review-security.md` for exact counts, changed-file manifest, remaining risks and the mandatory legacy transition runbook.

Production links must remain disabled until the fixed artifact is deployed and authorized operators complete identity provenance review and session/token revocation. No production access or transition was performed. No new schema/migration/dependency/infrastructure change was made for the review fix. Other deployment, privacy/logging, billing reconciliation, retention, upgrade/restore, configuration and manual accessibility gates remain; **overall NO-GO remains**. The temporary PostgreSQL server shutdown is still outstanding; this task deleted only its synthetic regression database.

## Initial audit record

Audit date: 2026-10-19. Local branch: `audit/orthodoxai-hardening`; HEAD: `c7fa8b0`. This report covers the local working tree, including uncommitted Phase 5–7 changes, rather than HEAD alone. See `phase-8-change-inventory.md` for the complete file inventory and `phase-8-environment.md` for configuration requirements.

## Scope and restrictions

No application source, schema, migration, package manifest or dependency lockfile was changed in Phase 8. No production systems, existing databases or customer records were accessed. No live AI, payment or email APIs were called. Nothing was committed, pushed or deployed. Browser, viewport and screen-reader checks remain unverified; no browser dependency was installed.

With explicit approval, PostgreSQL 17.11 Windows portable binaries were downloaded from the official EnterpriseDB HTTPS distribution into a unique temporary directory. A new loopback-only instance on `127.0.0.1:55483` used synthetic data and no Windows service. Native fixtures verify its data directory before creating randomly named databases; fixture databases are dropped after tests. No existing DATABASE_URL or DIRECT_URL is used by this native harness. This temporary instance uses local trust authentication and is not suitable for deployment.

Cleanup is BLOCKED: stopping PID 13460 through pg_ctl failed in the sandbox with `Operation not permitted`. Both elevated stop requests were rejected by execution approval, the second after renewed user authorization, with `Rejected("rejected by user")`. The instance may still be running. An authorized operator must stop this exact temporary instance; do not stop an unrelated PostgreSQL service. Its root is recorded in `%TEMP%/orthodoxai-phase8-location.txt`.

## Exact final verification results

| Check | Passed | Failed | Skipped | Exit |
| --- | ---: | ---: | ---: | ---: |
| blog-security | 33 | 0 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 | 0 |
| phase2-security | 45 | 0 | 0 | 0 |
| phase3-billing | 66 | 0 | 0 | 0 |
| phase4-auth | 51 | 0 | 0 | 0 |
| phase4-ssrf | 69 | 0 | 0 | 0 |
| phase5-conversations | 52 | 0 | 0 | 0 |
| phase6-api | 36 | 0 | 0 | 0 |
| phase6-retries | 18 | 0 | 0 | 0 |
| phase6-postgres (embedded PGlite) | 57 | 0 | 0 | 0 |
| phase6-frontend | 9 | 0 | 0 | 0 |
| phase7-ui | 35 | 0 | 0 | 0 |
| Existing suites subtotal | **519** | **0** | **0** | **0** |
| New phase8-postgres (native PostgreSQL) | **23** | **2** | **1** | **1** |
| Combined final cases | **542** | **2** | **1** | — |

There were zero cancelled final cases. Commands: `node tests/run-regressions.mjs` and `node tests/run-regressions.mjs phase8-postgres`. The regression runner retained process isolation, one worker, bounded test/suite deadlines; the successful existing-suite run did not hang. The initial approval rejection was retried only after renewed authorization.

| Other verification | Exact result |
| --- | --- |
| TypeScript: `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |
| ESLint: `node node_modules/eslint/bin/eslint.js .` | Exit 0; 0 errors, 1 existing warning: unused eslint-disable in generated `src/app/.well-known/workflow/v1/flow/route.js:2` |
| Prisma schema validation | Exit 0; schema valid; no migration executed by this command |
| Credential-free Next.js production build | Exit 0; Next.js 16.3.4; **87/87 pages generated** |
| Offline dependency tree | Exit 0; six extraneous installed WASM packages; manifest/direct-lock entries matched |

The production build was successful twice, including the user's exact credential-removal command. The latest run compiled in 4.6 seconds, completed TypeScript in 6.6 seconds and generated 87/87 pages. It emitted an existing parent-directory lockfile warning involving `C:/Users/User/package-lock.json`; that file was not modified. Credential-like environment names were removed only from the build process; no dummy keys were introduced. No root .env files were found. A successful credential-free build does not verify runtime provider configuration.

## Release blockers

### 1. Raw billing migration rejected by native PostgreSQL

`prisma/migrations/20261018000000_billing_integrity/migration.sql` starts with UTF-8 BOM bytes `ef bb bf`. Submitting the unmodified SQL to native PostgreSQL 17.11 returns SQLSTATE **42601**, `syntax error at or near "﻿"`, before its migration body executes. The new native regression intentionally retains this failure.

To investigate the remaining features, the fixture rolls back and removes the single leading BOM **in memory only** before continuing. No on-disk migration was edited. Consequently, the 23 passing native checks are conditional on that diagnostic normalization, and are not proof that the untouched migration chain deploys successfully.

A separate request to run the actual Prisma migration engine against another fresh isolated database was rejected by execution approval. That route remains unverified: the direct SQL failure must not be presented as a proven Prisma CLI failure. Before release, authorize review of applied migration history/checksums, correct the encoding safely if appropriate, and rehearse the actual deployment command. Never rewrite an already-applied migration blindly.

### 2. Review-account email preclaim can retain an attacker-known password

`src/lib/security/auth-service.ts` permits ordinary registration of the configured review email. Normal login accepts a correct password without requiring email verification. In `src/app/api/review/fr-josiah/start/route.ts`, the authorized review link upserts by that email, marking the existing account verified and PRO without rejecting or clearing an existing password hash. `src/app/api/review/clergy/start/route.ts` contains the same pattern.

The new native test registers a fresh synthetic review email, sets synthetic review credentials, invokes the real authorized Fr Josiah start handler, and verifies the resulting account. It fails because the unverified preclaim retains its known password while being promoted to verified PRO. The response is 307. An attacker need not know the review token if a legitimate reviewer later opens their authorized link. The clergy variant was inspected, not separately executed in the native test.

Recommended approved follow-up: provision review identities explicitly server-side; reject password-bearing/unverified collisions and avoid promotion based solely on an email match. Until fixed, disable the optional review links in production or have an authorized operator verify and secure those identities. No source fix was made during this audit.

## Native database coverage and limitations

The native suite exercises independent PostgreSQL connections and transaction advisory locking; concurrent fifth Free and hundredth Pro admissions; sixth/101st rejection; failed-operation charging and lease release; concurrent idempotent chat and personal-operation execution; owner-only interrupted-turn recovery and stale-write fences; cross-user foreign keys; immutable answer-source snapshots and completed turns; cached response expiry and identity retention; simultaneous password reset, sibling-token invalidation and session revocation; webhook replay deduplication for both providers; delayed Lemon Squeezy snapshots; verified trials; failed-cancellation deletion fences; uncertain checkout fences; cross-provider pending-checkout uniqueness; atomic research job claiming; account deletion cascades and detached billing tombstones; and transaction rollback/lock release.

The one skipped case is the complete historical pgvector migration replay: this vanilla PostgreSQL installation has no pgvector extension. Three historical vector-dependent migrations were omitted only from the synthetic baseline. They were not edited. The full pgvector chain, embedding index compatibility, production-scale lock durations, actual Prisma deployment-engine execution, backup restoration and real hosted workflow infrastructure are unverified.

Earlier diagnostic runs are not the final result: the first native attempt was blocked by the BOM before fixture setup; a later 25-case attempt had 22 passes, 2 failures and 1 skip. A Pro-boundary fixture initially hit the legitimate per-minute limiter; aging synthetic prior usage outside that window corrected the fixture without changing application code. The final 26-case run has the results above and deliberately exposes both release blockers.

## Additional security and operational risks

* **Sensitive logging:** `src/lib/patristics/build-patristic-research-context.ts:306` logs raw research queries, which can contain private conversation context. `src/lib/prisma.ts:16` enables query/error/warning logs in production. Restrict log access/retention and approve redaction. No production logs were inspected; normal SQL query logs do not establish that every parameter is printed.
* **Legacy entitlements:** `src/lib/billing/service.ts` preserves legacy PRO access where no verified billing-access deadline exists. The bounded 72-hour grace applies to previously verified paid records; unreconciled legacy fallback can outlast it during provider failures. Reconcile legacy provider ownership and duplicate mappings before cutover without removing legitimate paid access.
* **Retention jobs:** private AI response caches have a seven-day policy, but physical cleanup requires the authenticated POST cleanup endpoint to be scheduled. No repository cron configuration establishes that it is running. Expired authentication buckets and eligible 90-day detached billing records also need an operational cleanup owner. Account deletion of keyed private caches passed; unkeyed reservation metadata can retain raw user subjects and needs a documented retention/anonymization decision.
* **AI financial exposure:** per-user quotas, rate/concurrency controls and idempotency do not provide an absolute global spending ceiling. Research fan-out and provider SDK retries can incur multiple provider calls; workflow dispatch reservations do not necessarily cover the entire background job duration. Provider budgets, alerts and worker concurrency need operator verification. No live cost experiment was performed.
* **Timezone cutover:** quota timezone must be explicit, but PostgreSQL TIMESTAMP defaults also depend on database/session timezone. The fresh local cluster defaulted to Europe/Berlin. Verify production historical timestamp semantics and database session settings before pinning configuration; do not silently shift reset boundaries. Native midnight/DST deployment behavior is not fully established by these tests.
* **Request/ingress hardening:** bodyless cookie-authenticated sensitive POST endpoints lack an explicit application Origin/Fetch-Metadata check; SameSite cookies mitigate common cases but trust in sibling origins remains relevant. Webhook bodies are read before signature verification, so ingress payload limits need verification. These are follow-up hardening observations, not demonstrated arbitrary cross-site exploits.
* **Resource bounds:** journal history/export can be large; provider reconciliation inside billing transactions can hold locks/connections for extended periods. Verify pool sizing, transaction-compatible pooler behavior, monitoring and realistic load.
* **Grounding/injection:** system-role separation and provenance snapshots improve integrity but do not prove model immunity to prompt injection. Claim mappings are intentionally absent when explicit reliable evidence is unavailable. No live adversarial model evaluation was run.
* **UI verification:** automated UI regressions passed, but responsive rendering, zoom, touch, actual keyboard focus and assistive technology behavior were not browser-tested. In-memory drafts do not establish persistence through full page reloads.
* **Dependency assurance:** no online CVE/advisory audit or clean CI install was performed. Six extraneous WASM packages exist in the local installation. These do not invalidate the successful local build but limit reproducibility assurances.

## Repository and secret review

No net deleted files were found against pre-remediation base `41e4baf`. No tracked .next, node_modules, generated Prisma, build/output or workflow-generated route artifacts were found. The local pattern scan covered 290 files and the reachable Git history scan covered 99,166 patch lines; both reported zero recognizable secret hits. This is pattern-based evidence, not proof that all secrets are absent. No secret values were printed. Review-link URLs and operational logs still require careful handling.

## Migration review and deployment prerequisites

The candidate additive rollout sequence is:

1. `20261017000000_ai_reservations_and_job_claims`
2. `20261018000000_billing_integrity`
3. `20261019000000_auth_source_security`
4. `20261019000000_conversation_memory_provenance`
5. `20261020000000_api_quota_integrity`

Which migrations are actually pending in production is unknown. The archived `prisma/proposed-migrations/phase-3-billing-integrity.sql` is not an additional deployable migration. Preserve existing users, ChatMessage records, provider references and payment history. Nullable legacy links and additive models avoid a required destructive chat backfill. Native synthetic legacy records survived the diagnostic schema upgrade.

Phases 3–6 SQL contain explicit transaction boundaries; Phase 2 does not contain an explicit BEGIN. Do not assume deployment-engine rollback semantics without rehearsal. Ordinary index creation can block writes on large tables. Historical embedding drop/restore migrations must not be replayed against an already migrated production database.

## Ordered release checklist — not executed

1. Obtain approval for the two blocker fixes, implement them separately and rerun affected regressions plus all required checks. Freeze a reviewed artifact containing all required currently untracked files; deploying HEAD alone omits later phases.
2. Have an authorized operator take an encrypted backup and rehearse restoration into a separate authorized environment, including provenance, billing tombstones and deletion obligations. No production backup was taken in Phase 8.
3. Inspect actual migration history/checksums, schema, pgvector version/dimensions, duplicate provider mappings and historical timestamp semantics. Resolve the BOM according to applied status. Rehearse the entire canonical chain through Prisma with pgvector and failure injection in isolation.
4. Configure the environment inventory: trusted proxy IP handling, stable quota timezone, authorized verified administrator IDs, payment products/webhook secrets, email domain, AI keys/budgets and workflow infrastructure. Keep development test endpoints off and review links disabled until secured.
5. Schedule a controlled write-drain/maintenance window. Drain old chargeable requests and research workers; old binaries that ignore new fences/idempotency must not serve mixed-version sensitive writes.
6. Apply only approved pending canonical migrations using a direct, least-privileged deployment connection and a single deployment operator. Budget index-lock windows; stop on failure and inspect constraints/triggers and preserved row counts. No migration is authorized by this report itself.
7. Configure authenticated hourly POST cache cleanup, expired auth-bucket cleanup, minimum eligible billing-record purge, retention audits and manual fence/recovery runbooks. Never clear billing fences solely because time elapsed. Ensure workflow storage/queues survive process restarts.
8. Run staged synthetic end-to-end checks and manual accessibility checks. Reconcile legacy entitlements before opening billing writes. Any live payment/email/AI or production test requires separate authorization; authoritative server state must confirm payment success.
9. Monitor quota-versus-rate-limit errors, provider spend, stale leases/turns/jobs, database locks/connections, failed cancellation and uncertain checkout fences, webhook age/replay, email failures, rejected SSRF attempts and overdue retention cleanup. Redact private content from telemetry.
10. Keep a tested rollback binary compatible with the new schema/fences. Preserve additive data and triggers; do not restore an insecure old binary or drop new tables as a shortcut. Database restoration requires explicit disaster approval and reconciliation of provider events and deletion records so deleted accounts/sessions are not resurrected.

## Phase 8 changed-file manifest and decision

Only these four files were added during Phase 8:

* `tests/phase8-postgres.test.mjs`
* `docs/phase-8-readiness.md`
* `docs/phase-8-environment.md`
* `docs/phase-8-change-inventory.md`

All other dirty/untracked files predate this audit; the inventory records them for release completeness. Temporary PostgreSQL binaries, data and diagnostic files are outside the repository.

**NO-GO.** The production build is green, but the raw migration failure and demonstrated review-account preclaim prevent a readiness recommendation. Actual Prisma/pgvector migration rehearsal, operational configuration, retention scheduling and manual accessibility verification remain outstanding. The disposable PostgreSQL stop remains an explicit cleanup blocker. Phase 8 ends here; no deployment is approved.

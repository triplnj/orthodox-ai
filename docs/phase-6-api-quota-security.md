# Phase 6 — API validation, quota accuracy and errors

Implemented locally after architecture approval. No production system or customer record was accessed. No application migration was executed, and no live AI, payment or email call was made. No commit, push or deployment was performed.

## Behavior and compatibility

The existing Phase 2 admission lock, five-minute renewable capacity lease, shared per-user concurrency slot, ten-per-minute limit and quota values remain. Chat remains Free 5 / Pro 100 daily; prayer, fasting, Scripture and journal summaries share the existing 30-operation personal pool. Research and review retain their separate accounting. The existing post-admission failure charging policy remains.

Validation, authentication/permission and deterministic journal ownership/existence/size checks run before reservation. Rejected admission never inserts another charged reservation. A disappearing or changed resource after admission remains an admitted failure. Daily quota reads and admission now share the same short advisory lock, so response counters are coherent snapshots. Free's fifth admitted request returns its answer with remaining=0; the sixth is rejected. Pro's 100th/101st boundary is equivalent.

Chat answer/source snapshots remain immutable. A replay returns the original answer and original sources but overlays a fresh quota snapshot and current plan display. Account and dashboard report the chat pool explicitly, and Pro's dashboard displays its real allowance rather than claiming unlimited requests. Remaining counts include a timestamp and reset instant. Clients ignore older quota snapshots. A count is authoritative at its observation time, not a promise that another tab cannot subsequently reserve usage.

## Request validation

The existing Zod dependency supplies strict per-feature schemas. The common JSON reader checks application/json or application/*+json media types (with charset parameters), streams within a byte cap, rejects invalid UTF-8, malformed JSON, non-object roots and oversized bodies, and cancels a body after five seconds. Error messages never echo submitted secret values.

- Authentication retains its 16 KiB cap, password/token rules, durable anti-abuse limits and generic acknowledgments. Forged identity, privilege and verification fields are now rejected, rather than silently ignored. Existing legitimate registration, verification, reset, login and password-change workflows remain covered by Phase 4 integration tests.
- Chat retains its 64 KiB cap, per-field bounds, configured token budgets, feature enumeration and stable identity formats. Conversation path IDs and recovery bodies are validated, and unknown recovery fields are rejected.
- Journal JSON permits 256 KiB with title <=200 and content <=40000 characters. This accommodates UTF-8 content while matching existing summary eligibility. Legacy stored content is not truncated or rewritten.
- Profile names retain the existing 80-character maximum and must be strings. Onboarding accepts only the existing choices, with no string coercion of objects/arrays.
- Personal plan enums match existing UI values. Free text is bounded to 2000 characters and optional fields remain optional for older callers. Unknown fields are rejected.
- Query readers reject unsupported or duplicate scalar parameters. Existing no-query history, journal, account, dashboard, export and conversation list routes reject invented pagination/date/filter fields. No new pagination policy or date-input feature was added.
- Blog server actions retain administrator authorization and server sanitization. They reject File values, duplicate/unknown fields, invalid IDs/status, excessive lengths and payloads. Limits: title 300, slug 200, excerpt 2000, category 100, HTML 524288 characters with a 600000-byte total form cap. Paste HTML is capped at 512 KiB. Editor submission also checks the 512 KiB content-byte limit and required text. Existing stored posts are not rewritten. Standard Next server-action metadata is permitted. No blog comment API exists or was added.
- All existing research endpoints retain their Phase 2 authorization and Phase 4 SSRF transport. Their wrappers validate query/job/language/source-URL contracts before quota admission. Maintenance routes still accept no body. Provider strategy, prompts and patristic grounding are unchanged.
- Account deletion confirmation and billing recovery receive bounded strict request parsing. Billing services, entitlements, cancellation/deletion fences, pricing and provider reconciliation are unchanged. Webhook raw-body signature handling is unchanged; only safe JSON error formatting was standardized at those boundaries.

Stricter rejection of previously ignored/invalid input is intentional. Older valid personal AI requests without requestId continue working, but cannot acquire a durable retry guarantee retroactively.

## Structured errors

The existing string error and flags remain. API boundaries add stable codes, and schema failures include safe fieldErrors. Existing success shapes remain, with additive quota fields on affected AI responses.

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON, fields, ID, enum or query parameters |
| 401 / 403 | Authentication / authorization failure |
| 404 | Resource or owned request not found |
| 408 | Request-body read timeout |
| 409 | Identity conflict, unfinished request, fenced result or changed resource |
| 410 | Private cached result expired; old key cannot execute again |
| 413 / 415 | Oversized payload / unsupported media type |
| 429 | Distinct daily, rolling-rate or concurrency limit |
| 502 / 503 / 504 | Recognized AI upstream, uncertain outcome/configuration, or upstream timeout failure |
| 500 | Unexpected internal failure |

SQL details, stack traces and diagnostic fields are removed from API error responses. Known upstream errors receive safe messages. Daily exhaustion includes the actual reset and Retry-After. The rolling rate response conservatively recommends 60 seconds; it is an upper-bound cooldown, not an exact earliest-capacity calculation. Concurrency does not promise that a renewable lease predicts provider completion time.

## Durable personal-operation identity and recovery

New personal-plan and journal-summary clients send requestId. The reservation stores a SHA-256 fingerprint of canonical validated input, scoped by subject + feature + key. Existing-key lookup happens under the existing admission lock before charging. Matching completed requests replay without a new AI call or reservation; different inputs return 409. Running, failed, recovered and expired keys never automatically execute again.

New owner-scoped routes:

- GET /api/ai/usage?feature=...
- GET /api/ai/requests?feature=...&requestId=...
- POST /api/ai/requests/recover with feature and requestId

Only the personal feature enum is permitted for result/recovery lookup. Request lookup never accepts another user's ID. It does not grant subscription access to new AI execution.

Recovering an unfinished request changes RUNNING to ABANDONED. Completion is conditional on RUNNING under the same lock; stale workers cannot save a cache or journal summary. ABANDONED still occupies the existing concurrency slot while its renewable lease is live. Its old worker can renew/retire only that capacity lease, without changing the terminal completion fence. No provider/network call is held inside a database transaction. Failed keys are already terminal; explicit recovery acknowledges that before the UI prepares a new key. Completed results cannot be recovered.

For keyed summaries, the journal write and response snapshot/status completion commit together. The write checks owner and the original title/content, so a late summary cannot overwrite a changed entry. Replay never writes the journal again. Frontend journal updates reject older entry snapshots.

An ambiguous provider/commit outcome retains the key and charge. An expired lease never permits same-key regeneration. Recovery does not cancel remote AI billing or refund usage. An explicit new request may incur another charge. Existing lease expiry behavior remains, so an unresponsive worker can eventually stop blocking *different* keys, but its old identity still cannot rerun.

Frontend request state stores only an opaque pending key in sessionStorage, not journal content or plan inputs. In-memory retries retain the same payload/key. On reload, current form input can be submitted using that same key; a different already-recorded fingerprint conflicts safely. A 404 status lookup does not discard the key, because an earlier HTTP request might still arrive. New keys are created after a known rejected first submission, successful completion, expired terminal result, or explicit successful recovery—not merely an uncertain network error. Rapid clicks are guarded synchronously and buttons show pending/loading states.

## Seven-day private-response retention

Private AiReservation response caches are replayable for **seven days after finishedAt**. They contain whitelisted plan output, or the existing summary plus journal-entry response fields. The latter includes journal text to preserve the existing response shape; it is sensitive duplicate data. They never contain credentials, headers, system prompts or raw provider diagnostics. Application snapshots are capped at 240000 serialized UTF-8 bytes; PostgreSQL additionally enforces an object/262144-byte JSON-text bound.

At expiry, cleanup changes COMPLETED to RESULT_EXPIRED and writes SQL NULL via Prisma.DbNull. It preserves the row, request key/hash, original creation/finish timestamps and charge. Expired keys return 410 or expired status and never regenerate. The trigger permits this one-way erasure only after seven UTC days. Ledger/tombstone rows are not time-pruned, avoiding quota resets and key reuse.

Cleanup occurs on personal request/result access and through:

    POST /api/internal/ai-cache-cleanup
    Authorization: Bearer <AI_CACHE_CLEANUP_SECRET>

Before deployment, configure an external scheduler to invoke this endpoint **at least hourly**, and alert on missed/failed runs. The access path denies replay after seven days regardless of scheduler state. With a healthy hourly scheduler, physical cache deletion occurs within seven days plus one scheduling interval. If the scheduler fails, inaccessible payloads may remain physically stored until cleanup succeeds; this is an operational prerequisite, not a guarantee that an undeployed job runs by itself. Database and application clocks must be synchronized.

All new cached rows require a real user foreign key. Successful account deletion cascades cached responses and tombstones in every lifecycle state; a billing-blocked deletion correctly retains the existing account. Late workers cannot upsert/resurrect deleted rows. Legacy NULL-linked reservations contain no new cache payload and require no ownership backfill.

This retention rule applies to the new temporary reservation caches. Original journal entries and Phase 5 conversation history/provenance are durable user records and remain governed by existing account deletion; this phase does not erase historical messages or their immutable source snapshots.

## Explicit quota timezone and safe rollout

AI_QUOTA_TIMEZONE is an IANA timezone used server-side by every quota admission and read path. Production runtime quota operations fail closed with 503 if it is missing or invalid. Module imports and credential-free builds do not require runtime configuration. Development/test omission preserves the local host timezone, and tests pin UTC explicitly where appropriate.

Before deployment, establish the **existing production runtime's effective timezone** and pin AI_QUOTA_TIMEZONE to that same IANA zone across all instances. Do not assume it matches this workstation, a user's timezone or UTC. If it cannot be established, do not enable the new runtime yet. No historic timestamps or usage rows are rewritten. Next reset is the next calendar midnight in that zone, including 23-/25-hour DST days. Never change this setting casually during a day; a future policy change requires its own coordinated accounting cutover.

## Additive schema and deployment order

Prepared, not applied: prisma/migrations/20261020000000_api_quota_integrity/migration.sql.

Adds nullable userId, requestKey VARCHAR(128), requestHash CHAR(64), and responseSnapshot JSONB to AiReservation. Adds the user cascade relation, unique subject/feature/key index, user index and status/finishedAt retention index. Legacy NULL keys remain valid and distinct. No backfill, new table, quota-value change or application-data update is required.

SQL checks enforce keyed owner/subject/feature/key/hash consistency, valid lifecycle/snapshot/finish-time combinations and bounded JSON objects. A trigger protects identity/charged timestamps, terminal states and completed payloads; its exceptions permit abandoned-worker lease updates and overdue one-way cache erasure. Retention comparison is explicitly UTC, independent of the database session timezone.

Future deployment prerequisites:

1. Validate the whole unapplied migration chain and constraints on a disposable native PostgreSQL environment with representative data and independent sessions; assess index/FK locking time and take an authorized backup.
2. Pin the quota timezone to the existing production zone on all new instances. Provision an unpredictable AI_CACHE_CLEANUP_SECRET and configure/monitor the hourly authenticated POST job.
3. Apply the approved migrations before serving new code, regenerate Prisma client, and install from the lockfile.
4. Roll out backend/frontend together. Old clients remain compatible but requests reaching old instances have no new durable personal-operation identity.
5. Check synthetic non-production request boundaries, timezone/reset metadata, deletion cascades and cleanup metrics. Do not clear pending identities just to recover a rollout.

No such deployment, scheduler provisioning or migration execution was performed here. Billing, AI provider and authentication runtime secrets otherwise retain their existing configuration requirements. The added @electric-sql/pglite dependency is development/test only.

## Verification

Final regression results are recorded below. Each suite runs in a fresh Node worker, one suite at a time, with 30-second test and 60-second suite deadlines. Live AI/payment/email/network boundaries are mocked. PostgreSQL tests create disposable in-memory fixture tables and install the exact proposed constraint/index/trigger contract clauses. They do **not** run the application migration or connect to an existing database.

| Suite | Passed | Failed | Skipped | Cancelled |
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
| phase6-postgres | 57 | 0 | 0 | 0 |
| phase6-frontend | 9 | 0 | 0 | 0 |
| Total | 484 | 0 | 0 | 0 |

The 120 new cases include malformed JSON/media/ID/payload/query inputs; fifth/sixth Free and 100th/101st Pro admission; fresh replay counters; independent pools and DST resets; concurrent duplicates and different keys; admitted failures and uncertain commits; recovery/late summary/account-deletion races; seven-day erasure and SQL NULL sentinel; actual frontend handlers, network loss, 404 ambiguity, same-key retries, double clicks and zero-remaining answer display. PostgreSQL tests cover the complete 5x5 lifecycle transition matrix, unique conflicts, size/identity/ownership checks, retention and UTC boundaries, rollback and user-deletion cascades.

Earlier runs exposed expected strict-validation fixture changes and frontend test-rendering errors; they were corrected and no failures remain in the final run. Existing tests now send the JSON content type real clients use, use realistic maintenance/delete request shapes, and assert forged privilege fields are rejected without creating users/sessions. Assertions protecting authorization, sanitization, quotas, billing, sessions and provenance remain.

Prisma schema validation and client generation passed. TypeScript tsc --noEmit: exit 0. ESLint: exit 0, zero errors and one existing generated-workflow unused eslint-disable warning. Credential-free Next.js 16.3.4 production build: exit 0, successful compilation/typecheck and 88/88 pages generated. AI, payment, email, database and other key/secret/token environment variables were removed from the build process; no dummy credentials were supplied. The existing parent-directory lockfile warning is outside this phase. After the successful full 484-case run, the 36-case API suite was rerun successfully with additional account/dashboard timezone-error assertions; this does not increase the distinct-test total. git diff --check also passed.

## Remaining risks and verification limits

- Embedded PGlite executes PostgreSQL checks/triggers/transactions but has one underlying session. Parallel duplicate insert calls and application admission races are tested; independent native sessions, distributed deployments and real PostgreSQL advisory-lock blocking/cancellation are not fully reproduced. Native multi-session staging verification remains a deployment prerequisite.
- The migration has not been applied to an actual application database. Production data compatibility and large-table lock duration remain unmeasured.
- Physical seven-day cache deletion depends on successful scheduled cleanup. Reads deny expired replay, but scheduler outages need alerts and remediation. Tombstone rows intentionally continue growing until account deletion.
- Recovery cannot guarantee remote provider cancellation or avoid a second charge for an explicitly new operation. The same key is never automatically rerun. Legacy clients without request IDs do not receive the new personal-operation guarantee.
- Rolling-rate Retry-After remains a conservative 60-second recommendation. Counter observations cannot prevent another tab from consuming capacity after the snapshot.
- No live provider-quality or real-browser end-to-end testing was performed. Frontend tests execute actual handlers/hooks against mocked boundaries. Earlier model-level prompt-injection/factual risks and source-verification limitations are not changed by this phase.
- Input bounds may reject exceptionally large new writes that older code accepted. Existing stored messages/posts/journal entries remain intact. Strict unknown-field rejection is intentionally stronger than the old ignore behavior.

## Changed files

The manifest below identifies Phase 6 files, including files that also contain uncommitted Phase 5 changes. Phase 5-only provenance/retrieval/history artifacts were preserved and are excluded here. Generated .next, Prisma client and incremental caches are ignored local artifacts, not review source files.

- docs/phase-6-api-quota-security.md
- package-lock.json
- package.json
- prisma/migrations/20261020000000_api_quota_integrity/migration.sql
- prisma/schema.prisma
- src/app/admin/blog/[id]/edit/page.tsx
- src/app/admin/blog/actions.ts
- src/app/admin/blog/new/page.tsx
- src/app/api/account/route.ts
- src/app/api/admin/patristic-source-domains/route.ts
- src/app/api/admin/patristics/backfill-translations/route.ts
- src/app/api/admin/patristics/collect/route.ts
- src/app/api/admin/patristics/discover/route.ts
- src/app/api/admin/patristics/embed/route.ts
- src/app/api/admin/patristics/jobs/route.ts
- src/app/api/admin/patristics/repair/route.ts
- src/app/api/admin/patristics/verify/route.ts
- src/app/api/ai/requests/recover/route.ts
- src/app/api/ai/requests/route.ts
- src/app/api/ai/usage/route.ts
- src/app/api/auth/logout/route.ts
- src/app/api/billing/recover/route.ts
- src/app/api/chat/route.ts
- src/app/api/conversations/[id]/recover/route.ts
- src/app/api/conversations/[id]/route.ts
- src/app/api/conversations/route.ts
- src/app/api/dashboard/route.ts
- src/app/api/history/route.ts
- src/app/api/internal/ai-cache-cleanup/route.ts
- src/app/api/journal/route.ts
- src/app/api/journal/summarize/route.ts
- src/app/api/lemonsqueezy/webhook/route.ts
- src/app/api/onboarding/route.ts
- src/app/api/patristics/discover-background/route.ts
- src/app/api/patristics/enqueue-test/route.ts
- src/app/api/patristics/pg-clean-test/route.ts
- src/app/api/patristics/pg-general-test/route.ts
- src/app/api/patristics/pg-search-test/route.ts
- src/app/api/patristics/pg-translate-test/route.ts
- src/app/api/patristics/pg-verify-clean-test/route.ts
- src/app/api/patristics/pg-witness-test/route.ts
- src/app/api/patristics/process-job-test/route.ts
- src/app/api/patristics/start-workflow-test/route.ts
- src/app/api/pro/fasting-plan/route.ts
- src/app/api/pro/prayer-plan/route.ts
- src/app/api/pro/scripture-plan/route.ts
- src/app/api/review/chat/route.ts
- src/app/api/review/clergy/start/route.ts
- src/app/api/review/fr-josiah/start/route.ts
- src/app/api/settings/export/route.ts
- src/app/api/settings/profile/route.ts
- src/app/api/stripe/webhook/route.ts
- src/app/dashboard/page.tsx
- src/app/journal/page.tsx
- src/components/blog/BlogContentEditor.tsx
- src/components/chat/ChatBox.tsx
- src/components/pro/FastingPlanForm.tsx
- src/components/pro/PrayerPlanForm.tsx
- src/components/pro/ScripturePlanForm.tsx
- src/components/pro/usePersonalOperation.tsx
- src/lib/ai/chatService.ts
- src/lib/ai/operationLimits.ts
- src/lib/ai/personalRequests.ts
- src/lib/ai/quotaClock.ts
- src/lib/ai/requestSecurity.ts
- src/lib/ai/secureRoute.ts
- src/lib/api/blogInput.ts
- src/lib/api/clientErrors.ts
- src/lib/api/researchInput.ts
- src/lib/api/response.ts
- src/lib/api/validation.ts
- src/lib/billing/http.ts
- src/lib/patristics/api-security.ts
- src/lib/security/auth-http.ts
- src/lib/security/auth-input.ts
- src/lib/usage.ts
- tests/blog-security.test.mjs
- tests/helpers/phase6-harness.mjs
- tests/phase2-security.test.mjs
- tests/phase3-billing.test.mjs
- tests/phase4-auth.test.mjs
- tests/phase5-conversations.test.mjs
- tests/phase6-api.test.mjs
- tests/phase6-frontend.test.mjs
- tests/phase6-postgres.test.mjs
- tests/phase6-retries.test.mjs
- tests/run-regressions.mjs

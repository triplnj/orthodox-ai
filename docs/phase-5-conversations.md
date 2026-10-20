# Phase 5 — conversation memory and answer provenance

Implemented locally. No database migration was executed, no production data was accessed, and no live AI API was called. No commit, push, or deployment was performed.

## Architecture and compatibility

`Conversation` belongs to one authenticated account, independently of login sessions, and has an immutable feature context. `ChatTurn` belongs to that same account and conversation. Composite foreign keys prevent a message or turn being linked to a different owner. The API always obtains the owner from the authenticated session; client-supplied transcripts, source records, system messages and user IDs are rejected.

Existing `chat_messages` rows retain their IDs, content, timestamps, roles, categories and ownership. Both new links are nullable; the migration performs no backfill or content update. Legacy messages remain in the existing flat history, with no invented conversation boundaries or citations. New completed turns atomically save their user message, assistant answer, source snapshots and cached response. Failed questions remain in turn records and are shown by the recovery UI rather than entering completed conversation memory.

`POST /api/chat` retains its existing message/contextKey/extraContext inputs and answer/remaining/plan/patristicSources/provider flags. New clients send optional conversationId and requestId, and receive conversationId/turnId/requestId. Older callers without identifiers still work as independent new conversations; they cannot benefit from same-request retry deduplication unless they retain and resend an explicit requestId. The shared answer service retains its previous `{answer}` return contract for callers outside conversation chat.

`GET /api/conversations` lists threads represented in the account's existing visible history plus up to ten interrupted-thread identifiers. `GET /api/conversations/[id]` loads only an owned thread. The existing global history visibility window (Free: ten messages; Pro: one hundred) is applied before filtering a conversation, and also applies to cached answer replay. No pagination endpoint bypasses that window. Conversation memory is separately bounded for AI input. Export includes owner-scoped conversation records, evidence dossiers and original answer-source snapshots.

ChatBox can start a new conversation, resume a saved thread, reload saved status, retry the exact same request after a network interruption, and recover an unfinished turn. History links resume the correct feature context and display original source snapshots beside the corresponding answer. Legacy entries are explicitly labeled. Source links permit only HTTP/HTTPS without embedded credentials; message/source labels render as React text.

## Server-side configuration and costs

The following optional environment variables are read on the server for each request. They are never accepted from a client. Non-integer, negative, unsafe integer or below-minimum values use defaults; values above hard maxima clamp. Updating server configuration and restarting/redeploying instances adjusts limits without a schema or architecture change.

| Variable | Default | Hard maximum | Minimum |
| --- | ---: | ---: | ---: |
| CHAT_HISTORY_MAX_TURNS | 6 | 20 | 0 |
| CHAT_HISTORY_MAX_TOKENS | 4000 | 12000 | 0 |
| CHAT_QUESTION_MAX_TOKENS | 2000 | 4000 | 1 |
| CHAT_INPUT_MAX_TOKENS | 16000 | 32000 | 4000 |
| CHAT_OUTPUT_MAX_TOKENS | 2048 | 4096 | 128 |

`js-tiktoken` 1.0.21 uses the existing answer model's o200k_base encoding locally, without network requests. Text tokens are counted with a conservative framing allowance (12 per message plus 16 per request). The overall input budget includes all static system instructions, page/profile context, current question, retrieved evidence and history. Whole oldest question/answer pairs are removed first; quotations and static grounding instructions are never truncated. An oversized question is rejected before reservation. If complete evidence and required context still exceed the total input budget, the request fails before answer generation and asks for a narrower question. Research may already have run and the existing quota charge is retained. Length-truncated or empty generated answers are not persisted as completed answers.

At defaults, history adds at most 4000 input tokens per answer (including the history-pair allowance), without an extra LLM summarization call. Total answer-model input is bounded to 16000 estimated tokens, and output to 2048. Dollar costs depend on existing provider pricing and retrieved research; no current price lookup or live usage measurement was performed. Research models, retrieval strategies, temperature/model selections, subscription rules and quota constants were not changed. Deterministic referential follow-up expansion adds the bounded retained user questions to retrieval only for recognized English references; it performs no extra rewrite-model call. Retaining earlier questions avoids losing a named author after several referential follow-ups.

## Request identity, recovery and charging

New requests first claim a turn under a short per-user PostgreSQL advisory lock. `(userId, requestId)` is unique; a SHA-256 fingerprint includes the question, feature, extra context and supplied conversation identifier. Reusing an ID for different input returns 409. Completed matching requests replay the saved response without invoking AI or charging again, subject to the plan's visible-history window. Pending, running, failed or abandoned duplicate IDs return 409; they never automatically invoke AI again.

Only one active turn is permitted per conversation, protected by a pointer and a partial unique PostgreSQL index. Existing `withAiOperation` still owns admission, daily usage charging, rate/concurrency checks, heartbeat and lease behavior. It is unchanged. No long transaction stays open across research or AI calls. Free remains five daily chat calls; Pro remains one hundred; existing shared concurrency and rate limits remain intact. Failed admitted operations retain their previous quota treatment.

Owner-authorized recovery locks the user, rejects completed turns, marks the selected unfinished turn ABANDONED and rotates its execution token before releasing the conversation fence. Repeating recovery is idempotent. Both dispatch and completion verify the current token, status and active conversation pointer. A stale execution cannot persist its answer, sources or completion; failure cleanup cannot overwrite a completed or recovered turn. A known failed execution is already fenced by its terminal status.

The user-facing action restores the original question for an explicitly new request. Recovery never clears or refunds AI reservations and never automatically retries on elapsed time. If the old provider call is still running, unchanged concurrency checks can return 429. The provider might still finish and bill its old call: a database fence prevents stale writes, not remote cancellation. A process crash retains the turn fence until explicit recovery. Existing AI lease expiration behavior is preserved; it is not used to silently retry a turn. A database failure during commit cannot produce a falsely completed partial answer. If the client loses the response after a successful commit, retrying the same request retrieves the saved result.

## Immutable answer provenance and instruction boundaries

Each `ChatMessageSource` is attached to the exact assistant message, with stable order, provider, author, actual work title, reference, language, URL, scan URL, verification status and an immutable JSON snapshot. It also records retrieval time and whether the evidence was included. Available PG volume/scan-page/reference, curated document type/excerpt/source name, verified quote ID/confidence/exact-match/source type and structured passage locators are retained. Web citation titles are stored as webpageTitle, not promoted to patristic work titles. Original web URLs are retained separately from existing normalized selection URLs. Unknown bibliographic information remains null.

The full retrieved evidence dossier, including any provider-supplied claim ledger, is retained on the completed turn as evidence data. No current provider supplies validated links from the final assistant answer's particular claims to particular sources. Consequently `claimMappings` remains empty; no semantic matching or inferred attribution is fabricated. These snapshots establish what evidence was supplied, not independent proof that every generated claim is true. Primary-source OCR, verified database evidence, curated translations/bibliography and general live web research retain their original labels. Web-domain ranking does not upgrade a web source into a verified primary quotation.

Database triggers reject updates to source snapshots, completed turns and saved conversation messages. Existing account-deletion cascades can delete them for privacy. No automatic source refresh rewrites historical answers. Historical dossiers are not silently reused as fresh verification; referential follow-ups run the existing retrieval workflow again.

Only completed turns belonging to the authenticated user and exact conversation enter native user/assistant history roles. Retrieved evidence is sent as a lower-priority user data message, not interpolated into system instructions. Static Orthodox and claim-level grounding rules remain system messages. A static instruction explicitly treats documents and prior messages as untrusted data and previous answers as history rather than evidence. Role boundaries prevent structural system-message injection, but no model prompt can guarantee complete resistance to semantic prompt injection or factual errors.

## Migration and deployment prerequisites

Prepared only: `prisma/migrations/20261019000000_conversation_memory_provenance/migration.sql`.

The additive transaction creates Conversation, ChatTurn and ChatMessageSource, adds nullable conversationId/turnId columns, and adds ownership foreign keys, indexes, role/link checks, the active-turn partial index and immutability triggers. Existing user and message rows are not rewritten. The preceding Phase 2–4 migrations must already be applied in the target environment. Existing billing/authentication schemas and data are not changed here.

Before a future authorized deployment: back up and test the complete migration chain on a disposable PostgreSQL environment, including concurrent locks, triggers, account-delete cascades and index lock duration on representative table sizes. Apply migrations before serving the new application version; generate Prisma client from this schema and install from the updated lockfile. Then deploy the application and configure optional server limits. Existing runtime database, AI and authentication environment requirements remain; no new secret is introduced. Older application code can continue writing NULL-linked legacy messages during a staged rollout. It will not participate in new conversation memory, so use a coordinated rollout for consistent UX. A code rollback can leave the additive tables/columns in place; do not drop them or erase provenance to roll back application code.

No migration, schema push, database diff against a datasource, or customer-data query was executed. SQL generation compared two local Prisma schemas. Prisma validation and client generation passed. Actual PostgreSQL constraints/triggers and cross-process advisory locks have not been exercised against a database in this phase.

## Verification

The 52 Phase 5 tests cover multi-turn native-role context and referential retrieval; thread/user isolation; anonymous and unauthorized access; same-ID replay and fingerprint conflicts; simultaneous duplicates and competing turns; fenced recovery and stale completion; recovery idempotence; retained charges and unchanged Free/Pro exhaustion; provider/commit/truncated-output failures; atomic source association and deep snapshots; exact URLs and unknown bibliography; history visibility; legacy compatibility; Unicode token counting, configurable limits and hard maxima; oversized input/evidence; server-only credential-free imports; and lower-priority document/history injection handling.

All external services are mocked, and the test loader rejects live fetch calls. Tests run in isolated Node workers sequentially with 30-second per-test and 60-second per-suite deadlines. Initial full verification found one OpenAI service return-shape regression (20 passed, 1 failed in that suite). It was fixed by making budget metadata conversation-only; its rerun passed all 21, and Phase 5 passed all 52. Other full-run suites passed: blog 33, Stripe 27, Phase 2 45, Phase 3 66, Phase 4 authentication 51, Phase 4 SSRF 69. Final aggregate: 364 distinct tests passed, 0 unresolved failures, 0 skipped, 0 cancelled.

TypeScript `tsc --noEmit`: exit 0. ESLint: exit 0, zero errors, one existing generated-workflow unused eslint-disable warning. Credential-free Next.js 16.3.4 production build: exit 0, compiled successfully, TypeScript passed, 84/84 pages generated. OpenAI, Stripe, Lemon Squeezy, email, database and other key/secret/token environment variables were removed from the build process; no local .env files were present. The build retains an existing warning about a parent-directory package-lock.json outside this repository. The sandbox initially blocked isolated workers/build with `spawn EPERM`; authorized executions outside that restriction used the same mocked boundaries and credential removal. No dummy credentials were supplied.

## Remaining risks

- Live provider quality and end-to-end browser interaction were not exercised. Tests verify request payloads and service/route behavior with mocks.
- PostgreSQL migration, trigger and cross-process lock behavior requires disposable-database validation before deployment. Large existing tables may incur index/foreign-key locking time.
- Prompt-injection and factual risks remain at the model level despite role separation and unchanged claim-grounding requirements. Sources are evidence snapshots, not independently verified final-answer claim mappings.
- Remote AI calls cannot be guaranteed cancelled by recovery. An explicit new attempt may incur another provider charge and normal usage charge; stale old results are discarded.
- Oversized research dossiers or output can now require a narrower question. The failed admitted attempt retains existing quota charges. History limits intentionally omit older context; English-only deterministic follow-up expansion may miss references in other languages.
- Legacy history has no reliable conversation or provenance association and is intentionally not guessed. Older clients without stable request IDs cannot safely deduplicate network retries.
- Failed/rejected attempts and evidence snapshots add storage overhead. No destructive cleanup/retention job was introduced. Monitor storage and design any future pruning to preserve request identity and active execution fences.
- A cached replay contains the original response's remaining-count and plan snapshot, not a freshly calculated quota display; it does not grant entitlements or new AI execution.

## Complete changed-file manifest

- package.json
- package-lock.json
- prisma/schema.prisma
- prisma/migrations/20261019000000_conversation_memory_provenance/migration.sql
- src/app/api/chat/route.ts
- src/app/api/conversations/route.ts
- src/app/api/conversations/[id]/route.ts
- src/app/api/conversations/[id]/recover/route.ts
- src/app/api/history/route.ts
- src/app/api/settings/export/route.ts
- src/app/history/page.tsx
- src/components/chat/ChatBox.tsx
- src/components/chat/SourceCards.tsx
- src/lib/ai/chatService.ts
- src/lib/chat/context.ts
- src/lib/chat/conversations.ts
- src/lib/chat/history.ts
- src/lib/chat/provenance.ts
- src/lib/patristics/build-chat-context.ts
- src/lib/patristics/build-patristic-research-context.ts
- src/lib/patristics/web-patristic-research.ts
- tests/helpers/chat-models.mjs
- tests/phase2-security.test.mjs (storage mock extended; existing assertions retained)
- tests/phase5-conversations.test.mjs
- tests/run-regressions.mjs
- docs/phase-5-conversations.md

Ignored local artifacts regenerated: src/generated/prisma, .next, and TypeScript incremental cache. They are not source changes for review.

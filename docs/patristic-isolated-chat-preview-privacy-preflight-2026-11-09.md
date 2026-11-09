# Task 3 — isolated Chat Preview: privacy isolation preflight
Date: 2026-11-09

## Discoveries
- Existing Neon staging branch `br-spring-frost-assfzje6` contains 67 users, 89 sessions, 24 conversations and 114 turns, inherited from the production parent. Directly connecting an interactive Preview Chat to that branch would expose copied user data and is prohibited.
- Created a separate Neon clone `br-empty-breeze-asd2dqrq` (orthodoxai-chat-isolated-preview-2026-11-09), from the prior staging source branch. Clone initially contains the same 67 users, 89 sessions and 24 conversations, plus 297 patristic passages. **Not connected to Vercel**.
- The existing Vercel project `orthodox-ai-24li` has a shared Preview `DATABASE_URL` and `DIRECT_URL` inherited across branches, and branch-specific overrides were absent for this experimental branch on the last metadata inspection. Preview must not use inherited generic values.
- The test-branch Chat route now calls `enforceChatPreviewIsolation` **before** authentication, quota or conversation writes. It checks the isolated flag, the exact expected Neon clone branch ID, credentials presence/Neon host, one DB sentinel with `purpose=PATRISTIC_CHAT_ISOLATED_PREVIEW`, and absence of non-@example.test user accounts. No production request path is changed.
- Added CI test `tests/patristic-chat-preview-isolation.test.mjs`; successful staging diagnostic run `https://github.com/triplnj/orthodox-ai/actions/runs/42677777865` confirmed its initial checks.

## Pending approval (hard stop)
The newly created clone holds copied private user records. Destructive sanitization **requires the user's explicit authorization** before running SQL. Prepared the exact script at:
`scripts/patristics/REQUIRES-APPROVAL-isolate-chat-preview.sql`

The transaction would execute only against Neon **branch ID `br-empty-breeze-asd2dqrq`**, never the original source staging branch or production. It would truncate cloned user accounts and cascading sessions/messages/turns/usage/billing records, as well as independent billing webhook events, rate-limit buckets, blog posts carrying author email, discovery query jobs and domain audit actor records. It retains 297 library passages and their source/provenance links. It updates the clone's DB guard from the parent staging purpose to the isolated Chat Preview purpose after confirming the cleanup, and rolls back on any check failure.

## Work remaining after authorization
1. Sanitize the isolated clone and prove counts, preserving all 297 source passages and editorial review files.
2. Store *branch-specific* `DATABASE_URL` and `DIRECT_URL` in Vercel Preview settings using the clone's Neon connection string; do not decrypt/display credentials.
3. Configure safe test identities and outbound email/payment safeguards, then wire the reviewed staging resolver and source classification into the Preview-only Chat retrieval path.
4. Deploy the experimental branch to Preview and smoke-test actual authenticated question→source→answer while verifying no writes to production and accurate source attribution.
5. Save GitHub Actions/build and HTTP end-to-end evidence. No merge into main without user signoff.

## Status
**TASK 3 IN PROGRESS, NOT COMPLETE**; no Vercel database or Chat requests have been connected to the new clone, and no private user data has been deleted. No production modifications.

## User-approved sanitization and Vercel branch-only credentials

After explicit user approval to delete copied private records **only in the new test clone**, the first transaction was fully rolled back by the clone's `LibraryStagingGuard_purpose_check` check constraint. After verifying counts were unchanged, a second single transaction (targeting only `br-empty-breeze-asd2dqrq`) expanded that constraint, truncated cloned users and dependent private records, and set the new guard `PATRISTIC_CHAT_ISOLATED_PREVIEW`.

**Read-back after commit:**
- Isolated clone `br-empty-breeze-asd2dqrq`: users **0**, sessions **0**, conversations **0**, ChatTurn **0**, chat_messages **0**, email verification tokens **0**, password reset tokens **0**, billing webhook events **0**, BlogPost **0**; LibraryPassage **297**. Guard branch/purpose both match the isolated clone.
- Source staging `br-spring-frost-assfzje6`: users **67**, sessions **89**, conversations **24**, turns **114**, chat messages **844**, blogs **3**; LibraryPassage **297**; original staging guard unchanged.
- Production `br-flat-mode-as1mxdf8`: users **74**, sessions **96**, conversations **29**, turns **125**, chat messages **864**, blogs **4**. No destructive SQL was executed on it.

Four **branch-specific Preview** variables were stored in Vercel for `experiment/patristic-catalog-author-v2-20261109`: `DATABASE_URL`, `DIRECT_URL`, `ORTHODOXAI_CHAT_ISOLATED_PREVIEW=1`, and `ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID=br-empty-breeze-asd2dqrq`. Credentials were passed from Neon to Vercel without exposing their values in the user-facing record. Vercel metadata confirms that all four are encrypted and scoped exactly to the experimental git branch, not production or all Preview branches.

The now-approved SQL is already executed on the child branch; the file `REQUIRES-APPROVAL-isolate-chat-preview.sql` is a historical plan, **not** an instruction to rerun. Its initial form lacked the revised purpose check constraint and would fail without adjustment.

**Still required for task 3:** app-level integration of reviewed source resolver into Chat runtime, a QA-only test identity and safe off-switches for billing/outbound email, a new preview deployment built with current branch-specific credentials, and an actual authenticated Chat end-to-end test. None of those are claimed complete.

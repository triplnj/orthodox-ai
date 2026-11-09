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

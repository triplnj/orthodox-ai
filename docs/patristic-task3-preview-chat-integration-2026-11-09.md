# Task 3 — isolated Preview Chat integration progress (2026-11-09)

## Safety and database checks
- Isolated Neon branch `br-empty-breeze-asd2dqrq` is a clone of staging, **not** the production branch `br-flat-mode-as1mxdf8`.
- User-approved clone-only scrubbing completed; 297 patristic passages preserved; no imported user accounts or sessions remain.
- Exactly one synthetic, password-authenticated, verified Free-plan QA login `patristic-qa@example.test` was created in the isolated branch. Credentials are not stored in this repository.
- Read-back after QA provisioning: 1 QA account, 0 sessions, 297 passages; sentinel `PATRISTIC_CHAT_ISOLATED_PREVIEW`. Current production read-back: 74 users, 29 conversations, 864 messages, 4 blog posts, untouched.
- Four encrypted, **branch-scoped** Vercel Preview variables: `DATABASE_URL`, `DIRECT_URL`, `ORTHODOXAI_CHAT_ISOLATED_PREVIEW=1`, `ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID=br-empty-breeze-asd2dqrq`. No unscoped variable was modified.
- Chat route guard executes before authentication/quota writes. Guard fails closed on missing/mismatched Vercel branch identity, absent isolation flags, wrong Neon host or DB sentinel, or any non-@example.test account in clone.
- On isolated Preview only, email sends are forbidden, billing-provider API calls are forbidden, and registration/reset/verification are disabled; login accepts only @example.test identities.

## Integrated research path
- On the experimental Preview branch, questions naming Gregory of Nyssa are routed through `buildIsolatedGregoryResearch` in the real `/api/chat` pipeline.
- That pilot uses the reviewed logical author resolver against the isolated library's real author catalog, rejecting ambiguous author matches and unsupported comparisons.
- Only six Gregory passages from the published source-text audit are eligible, with passage IDs and stored content SHA-256 fingerprints checked on every retrieval. The LLM receives a tightly scoped evidence context and source cards with `STAGING_TEXT_MATCH_ONLY`. Direct quotation and unverified dialogue-speaker attribution are prohibited.
- Other questions retain the preexisting Chat research path. The existing production application is untouched.

## Tests and blocker
- GitHub Actions now runs the full protected staging tests, Prisma generation, `tsc --noEmit`, and tests of Preview isolation / outbound blocks.
- Vercel's previous Preview build failed on ES2017 `0n`; fixed. A subsequent strict typecheck caught a union narrowing issue in the new resolver bridge; fixed on `c738e27cb4b8290490de2930516038ff187e40ab`. Obtain the final CI run result before claiming a green typecheck for that commit.
- New Vercel Preview deployment is currently **blocked by Vercel API HTTP 402**, code `api-deployments-free-per-day`: exceeded 100 free-tier API deployments in the daily window. The platform requested retry after 86400 seconds. No bypass or production deployment was attempted.
- Consequently no new deployment of the integrated Chat code and **no actual authenticated HTTP Chat E2E answer** have yet been validated. Do not mark Task 3 complete until the Preview deployment is READY and live QA answers are audited.

No user credentials, API secrets or connection strings are embedded in repository files or this report.

## Confirmed final CI

GitHub Actions run https://github.com/triplnj/orthodox-ai/actions/runs/42686583533 completed **SUCCESS**, commit `c738e27cb4b8290490de2930516038ff187e40ab`.
- TypeScript `tsc --noEmit` / Prisma generate — success.
- Independent resolver and Preview outbound safety unit tests — success.
- Read-only nine-case patristic question-to-evidence integration — success.
- Source transcription audit and Gregory dialogue/identity staging checks — success.

The subsequent documentation-only commit does not change executable code. **Vercel remains HTTP 402 quota-blocked; no authenticated Preview Chat HTTP end-to-end result exists.** Next allowed action is a new branch-targeted Preview deployment once provider quota permits, followed by login of the isolated QA identity and controlled answer/source verification.

## 2026-11-10 — live Preview deployment and read-only runtime validation

Vercel API limit reset and a new Preview deployment of the experimental branch succeeded:
- Deployment ID `dpl_4PryqtNQpyF2XmvCp3FHExffRLxZ`, `READY`, commit `366281d4e11ffb655aa907381fcf7054b5504731`.
- Preview URL: https://orthodox-ai-24li-58m79goih-iconismusyahoocoms-projects.vercel.app
- GitHub Actions run https://github.com/triplnj/orthodox-ai/actions/runs/42806345859 succeeded including `tsc --noEmit`, resolver tests, nine staging question→passage cases and full transcription audit.
- A read-only Preview-only diagnostics route `/api/patristics/preview-readiness` verifies branch-specific env isolation, single database guard `PATRISTIC_CHAT_ISOLATED_PREVIEW`, no non-QA email accounts, source author route and all six ID+SHA-pinned Gregory passages; the deployed function responded HTTP **200** with `{"status":"READY","environment":"ISOLATED_PREVIEW","sourceProvider":"PROTECTED_STAGING_GREGORY","selectedSourceCount":3,"exactQuoteApproved":false,"speakerAutoVerified":false,"authenticatedChatTested":false}`.
- The deployed `/login` responded **200** and `GET /api/chat` responded **405**, consistent with a POST-only Chat API. This does not prove a signed-in POST succeeds.
- Production database **read-only** snapshot after the check: users **74**, conversations **29**, messages **864**, blogs **4**. No production write or migration.

**Remaining for full acceptance of task 3:** an actual logged-in QA `POST /api/chat` and evaluation of the generated response + source cards. The connected read-only URL fetcher supports GET but not an authenticated POST, so this final step has not been independently executed. The QA account already exists only in the isolated database; the user can login in the Preview browser using credentials shared earlier and provide the Chat response for review. The live readiness probe deliberately reports `authenticatedChatTested:false` until such a test is complete.

**Do not merge to production until that result and the following AI answer integrity tests are satisfactory.**

## 2026-11-10 — authenticated Preview Chat end-to-end acceptance

The user logged into the isolated Preview using the synthetic QA account and submitted:
"How does Macrina help Gregory of Nyssa overcome his grief after Basil’s death?"

The Chat returned a coherent English answer, naming the dialogue author Gregory of Nyssa and describing Macrina’s consoling appeal to the Apostle’s instruction to mourn with hope. The answer was compared against:
- https://www.newadvent.org/fathers/2915.htm
- https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/

The opening passages confirm Gregory's sorrow over Basil's death, Macrina's reasoned consolation and her invocation of the apostolic teaching. No switch of dialogue speaker or invented quotation was found in the answer. Two excerpt-to-claim links were displayed; a third source card had no linked claim.

A separate **read-only** inspection of isolated Neon `br-empty-breeze-asd2dqrq` confirmed **1 QA user, 1 session, 1 conversation, 1 ChatTurn, 2 messages, 3 ChatMessageSource rows and all 297 library passages**. The three sources have `verificationStatus=STAGING_TEXT_MATCH_ONLY`; mapped-claim counts 1, 1, 0. Production (read-only) remains at **74 users, 29 conversations, 864 chat messages, 4 blog posts**. No production writes or migrations.

The source-card wording was improved in experimental branch files `src/components/chat/SourceCards.tsx` and `tests/patristic-source-cards-clarity.test.mjs`: linked excerpts now explicitly disclose that interpretation has NOT been independently verified; unmatched sources are labeled as additional retrieved passages with no claim link. Verified with successful GitHub Actions run https://github.com/triplnj/orthodox-ai/actions/runs/42809689231 at commit `5ef189dfae925d82c5348047b81837f66772d5da`.

**Task 3: ACCEPTED for isolated Preview end-to-end workflow.** This constitutes one verified Chat response and operational isolation evidence; it does NOT establish high answer accuracy across topics. Task 4 remains the systematic answer/source/attribution stress-test phase, and the new source-card wording has not been separately smoke-tested in a new Preview deployment. No main merge or production deployment authorized.

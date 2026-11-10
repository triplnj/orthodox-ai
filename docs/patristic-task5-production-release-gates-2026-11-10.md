# OrthodoxAI — Task 5: production release gate and rollback plan
Date: 2026-11-10
**Status: PREPARATION ONLY — RELEASE BLOCKED**

## Hard rule
Do not merge this experimental branch into `main`, promote a Preview build, apply migrations, change production Neon secrets, or alter live Vercel traffic until every acceptance gate below is explicitly completed and reviewed. Production is separate and unchanged.

## Snapshot at release preparation
- Production branch: `main`, observed HEAD `b195c434133e101ba8de344ac01af1ab67e49622`.
- Experimental patristic branch: `experiment/patristic-catalog-author-v2-20261109`, observed HEAD `f930d0fcba8b0b52ebaad5a070b4f2b4837db814`.
- Latest listed READY production Vercel deployment: `dpl_3uGhbtpEM7ecQSmj3mpJYoB3FqsL`, source commit `46897f4beb3e639af6673911cc4ffbf6153ed338`. **Do not infer Vercel production currently matches GitHub main HEAD without verification.**
- The previous READY isolated Preview deployment SHA is `1f7679063766b051d57a787d1cafdc554104cd53`, with the observed unsupported immortality answer. It is NOT release-eligible.
- Latest staging code-check success before documentation update: https://github.com/triplnj/orthodox-ai/actions/runs/42819184569 at `af2ae135fb8d13ad334fd016a7bc072dd66c7b63`. Passing offline tests is not equivalent to live Preview acceptance.
- Vercel deployment API last returned HTTP 402 `api-deployments-free-per-day`. The corrected current-turn source gate has **not** been tested in a newly deployed signed-in Preview session.
- Protected Neon branches: production `br-flat-mode-as1mxdf8`; patristic library staging `br-spring-frost-assfzje6`; scrubbed isolated Chat Preview `br-empty-breeze-asd2dqrq`. Never mix their connection strings.
- QA staging used one synthetic `@example.test` user. That identity and test credentials must **not** be migrated or copied into production.

## Gate 1 — close task 4 on a fresh deployment (REQUIRED, NOT MET)
1. Confirm the latest experiment HEAD and successful type-check + staging source audits.
2. Deploy **that exact SHA** to a unique Vercel Preview URL, with encrypted branch-scoped Neon Preview DB secrets and `ORTHODOXAI_CHAT_ISOLATED_PREVIEW=1`.
3. Read-only endpoint `/api/patristics/preview-readiness` must return HTTP 200 with both `unsupportedSoulQuestionRejected:true` and `unsupportedFollowUpRejected:true`; any other response blocks release.
4. Authenticated QA, in **one new conversation**, ask in sequence:
   - "How does Macrina console Gregory of Nyssa after Basil's death?" -> answer follows the source-matched opening consolation.
   - "What does Gregory of Nyssa teach about the immortality of the soul?" -> clear source-scope limitation, **zero** inappropriately attributed source cards, **no** unsupported "inherently immortal" answer.
5. Repeat both prompts in fresh independent conversations, plus Serbian Cyrillic/Latin, out-of-scope exact quotation, and two-author comparison cases. Examine persisted `ChatTurn`, `ChatMessageSource` and claim mappings **in isolated Preview only**.
6. Only editorially confirmed theological claims and dialogue speakers should be approved. Text matching does not establish independent doctrinal correctness.
7. Regenerate 5-answer LLM holdout for the **exact** candidate commit; examine full answer texts rather than rely on structural scores. No accidental repeated bilingual paragraphs or overstatement of the Pauline consolation.
8. The corpus still has 73 sources quarantined after source text audit; no blanket approval. Publish a reviewed allowlist or abstain when evidence absent.

## Gate 2 — code and production-difference review (NOT MET)
1. Retrieve the exact delta between current `main` HEAD and candidate branch HEAD, including conflicting commits. Existing functions such as registration/verification, Free quota, Pro billing (Lemon Squeezy), admin blog, journal, confession preparation, and user data must not regress.
2. Make a **small production-targeted PR** for necessary source-resolution and validation components. Do **not** wholesale merge staging-only QA credentials, hardcoded branch sentinels, scripts, QA pages, test users or Preview-specific runtime guards into live production behavior.
3. Review Prisma schema and migrations for destructive changes. Favor **no production DB migration** for this initial retrieval-only patch. If one is actually required, independently review migration SQL on a fresh clone and make an explicitly approved backup/rollback plan.
4. Verify independent CI on the PR: `npm ci`, `prisma generate`, `tsc --noEmit`, relevant unit tests, `npm run lint` where configured, production build under mocked non-secret environment and regression of critical billing/auth paths.
5. Document release SHA, version, owner, approvals, expected behavior, and rollback point.

## Gate 3 — deploy and verify production (BLOCKED UNTIL GATES 1 AND 2)
1. Read-only preflight on actual production DB: counts and health baseline, zero planned deletions.
2. Confirm Vercel production deployment and database targets. Explicit operator approval for promotion/merge.
3. Deploy the reviewed code by the normal GitHub-connected Vercel pipeline, not by pointing production to the scrubbed test database.
4. Smoke tests: login/register/logout/password reset only with approved non-real identity; Free daily limit, PRO subscription/checkout **without making an actual payment**, admin blog CRUD in authorized test environment, Chat citation behavior and old pages.
5. Read-only Neon post-deploy count and schema consistency checks; inspect HTTP 500 and runtime logs.
6. If regression: roll back Vercel to the recorded last-known-good production deployment via operator-authorized rollback, and separately address schema changes (never reverse DB migrations implicitly).

## Explicit blockers
- ❌ Task 4 real, newly deployed Chat follow-up verification outstanding.
- ❌ No independent broader-author/corpus answer quality certification.
- ❌ Main-to-experiment delta, PR and production-specific smoke review outstanding.
- ❌ User has requested **preparation** of task 5, not explicitly approved production merge or deployment after known failed theological answer.

**Production remains unchanged. These notes are a plan, not an authorization to deploy.**

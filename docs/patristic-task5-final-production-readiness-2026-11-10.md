# OrthodoxAI — Fifth task: Production-readiness decision
Date: 2026-11-10
**Decision: NO-GO for the full new patristic architecture. Production deployment intentionally not performed.**

## Scope and state reviewed
- GitHub `main` at `b195c434133e101ba8de344ac01af1ab67e49622`.
- Experimental `experiment/patristic-catalog-author-v2-20261109` compared directly to `main` via GitHub compare: **174 commits ahead, 0 behind, 59 affected files**. This includes staging-specific source metadata, test fixtures, scrubbed QA branch constraints, preview-only routes, altered Chat service and rate/quota protections.
- Vercel last READY production deployment `dpl_3uGhbtpEM7ecQSmj3mpJYoB3FqsL`, source commit `46897f4beb3e639af6673911cc4ffbf6153ed338`. Distinct from current GitHub main; do not infer any live deploy from a main-branch commit.
- Read-only Neon production baseline: **75 users, 29 conversations, 864 messages, 4 blog posts** on branch `br-flat-mode-as1mxdf8`. No production writes performed during Task 5.
- A genuine authenticated QA Preview conversation on isolated database `br-empty-breeze-asd2dqrq` succeeded for two consecutive questions: Macrina's consolation returned three appropriate source cards, and an unsupported question on immortality returned a source-scope limitation with zero sources.
- Preview success demonstrates the narrow Gregory opening scene only. It is **not** certification of the rest of patristic literature, nor a demonstration that a production branch with real users will behave correctly.
- Latest experimental protected staging CI: https://github.com/triplnj/orthodox-ai/actions/runs/42893544574 succeeded. Latest real LLM generative holdout on the same SHA, https://github.com/triplnj/orthodox-ai/actions/runs/42893544539, **failed** at evaluation of five source-grounded AI answers (exit code 2). Review failures before accepting the full release. The app also required a corrective retry path after repeated real QA rejected answers, which makes unsupervised broad deployment premature.
- 297 library passages were audited in isolation with 73 quarantined as not source-verified. Quote matching alone does not confirm speakers or doctrinal interpretation.

## Production-targeted safe candidate
Prepared dedicated branch `release/patristic-source-clarity-review-20261110` created **from current `main`**, not from the 174-commit experiment, and opened **draft PR #55**:
https://github.com/triplnj/orthodox-ai/pull/55

The only runtime change is display transparency in `src/components/chat/SourceCards.tsx`:
- Replace misleading automated-review claim language with “Automated text match — interpretation not independently verified”.
- Explicitly mark additional retrieved source passages that are not linked to a claim.
- Clarify that matching excerpts do not certify theological meaning, speakers or verbatim quote permission.

A new small test `tests/patristic-source-cards-clarity.test.mjs` verifies these labels. This release candidate intentionally **excludes** the isolated Preview database credentials, guarded pilot provider, staging scripts, unrestricted QA quota, billing/email interceptors, speaker verification shortcuts, test user and all database changes.

The PR remains **DRAFT, NOT MERGED**. Do not change this release posture automatically.

## Release gates still required to approve broad production launch
1. Fix or document every failed real answer-generation holdout, rerun holdout successfully on the exact chosen production commit, manually inspect theological accuracy and source-to-claim fidelity.
2. Implement a production-safe, genuinely useful retrieval architecture for authors/topics beyond the six approved Gregory dialogue excerpts: enforce source and speaker provenance by reviewed passage ID and appropriate fallback when source evidence does not establish a claim. Keep quarantined passages excluded.
3. Run independent unit, type, lint, build and security regressions on a **small PR** prepared from current main. Verify login, email verification, free/pro daily quota and Lemon Squeezy, administrative blog, journal, confession preparation, Chat streaming and replay. Test without actual payments or real-user mutations.
4. Independently verify production Vercel secrets, authentication and database targets; use a protected preview for production-targeted code and run authenticated real Chat cases.
5. Record a new exact last-known-good production deployment and Neon backup point before approval; no schema change expected for UI-only PR. For a schema-changing launch, require an independently tested migration and rollback process.
6. User/operator to approve final reviewed diff and deployment, then verify live application with monitored rollout and immediate Vercel rollback availability.

## Overall verdict
**Task 5 release review and preparation is completed. The complete patristic architecture is NOT production-ready and has NOT been deployed.** Draft PR #55 is a safe subset available for review; it is not a substitute for the library's production readiness. The production baseline remains untouched.

# Task 4 incident: Unsupported immortality answer in isolated Preview (2026-11-10)

## Observed failure
The user submitted consecutive QA questions to an isolated Preview app:
1. "How does Macrina console Gregory of Nyssa after Basil's death?" — an appropriately source-anchored explanation of the dialogue opening.
2. "What does Gregory of Nyssa teach about the immortality of the soul?" — the app gave a confident statement that the soul is "inherently immortal", attaching only three passages from the work's *opening consolation scene*. This is NOT evidence for that broad metaphysical claim.

Read-only inspection of protected Neon clone `br-empty-breeze-asd2dqrq` confirmed both completed turns with `PROTECTED_STAGING_GREGORY` source provider; the second had 3 excerpt cards, not zero. No production DB changes.

The user's cards displayed the obsolete label "Claim linked to a matching excerpt (automated review)" instead of the wording present in later source-code revisions. This indicates an older version was used, although the exact URL of the user's session was not available and is not conclusively identified. The last known READY build (SHA `1f7679063766b051d57a787d1cafdc554104cd53`) contains the intended query-scope classifier, so UI staleness alone is not accepted as proof of root cause.

## Safeguard hardening
- The real user turn is now passed separately into `buildIsolatedGregoryResearch(query, process.env, message)`. This makes `classifyGregoryOpeningQuestion(currentMessage)` authoritative, not any preceding Macrina question concatenated to the retrieval context.
- Unsupported named Gregory topics return `sources: []` and deliberately do **not** fall back to the old generic research provider. The Chat route treats this as evidence-required and returns a precise limitation message rather than synthesizing unverified teachings.
- The read-only `/api/patristics/preview-readiness` probe checks the *exact user-reported question* standalone and as a follow-up to the approved grief topic. Both must yield zero sources and `PROTECTED_STAGING_GREGORY` attempted, no provider success. A failure responds 503.
- New regression `tests/patristic-gregory-preview-answer-scope.test.mjs` asserts current-turn scope and both simulation probes.

## Results and deployment blocker
- GitHub Actions `https://github.com/triplnj/orthodox-ai/actions/runs/42819184569`, revision `af2ae135fb8d13ad334fd016a7bc072dd66c7b63`: **SUCCESS**, including TypeScript, independent unit tests and staging question-to-passage integration.
- A new Vercel Preview deployment of that commit was **rejected** by provider status 402 (`api-deployments-free-per-day`, 100 API deployments/day; retryAfter 86400). No release, auto-promotion or production mutation was performed.
- The last known READY Preview deployment is at the *older* commit `1f7679063766b051d57a787d1cafdc554104cd53`, therefore no real HTTP proof of fixed behavior exists as of this review.

## Acceptance gate
**Task 4 remains OPEN.** Do not infer five generated-answer tests certify broader doctrine. Once the Vercel limit resets, deploy only the tested experiment commit, verify the readiness endpoint reports `unsupportedSoulQuestionRejected: true` and `unsupportedFollowUpRejected: true`, then submit the two consecutive authenticated Chat questions in the *new unique Preview URL* and inspect stored source cards and answer. A broad immortality claim must yield no sourced assertive doctrine, and no opening-dialogue excerpt cards. Keep main/production unchanged until acceptance.

# OrthodoxAI — Isolated staging question-to-evidence integration report
Date: 2026-11-09

## Scope and isolation
- Source commit branch: `experiment/patristic-catalog-author-v2-20261109`.
- Only Neon staging branch `br-spring-frost-assfzje6` is queried, after an exact `LibraryStagingGuard` check.
- No HTTP production Chat requests, no user conversations or quota mutations, no production branch changes, no OpenAI API calls, no generation of final doctrinal answers.
- Data read via Neon connector (real staged catalogue and passage records) and replayed through the checked-in integration code with a guarded mock DB transport. This is **not** yet an online Chat end-to-end test.
- A CI workflow has been extended to exercise the integration against staging secrets. Its completed GitHub Actions run is not verified here.

## Strict measured result
**5/8 passed**, with 3 release-blocking cases:

| Case | Expected evidence | Observed | Result |
|---|---|---|---|
| Basil on creation (English) | Relevant source excerpt | 3 excerpts, *Hexaemeron*, Homily I | PASS (routing/source envelope) |
| John Chrysostom on prayer (Serbian) | Relevant source excerpt | 0 excerpts | FAIL |
| Cyril of Jerusalem on Baptism | Relevant source excerpt | 1 excerpt, *Catechetical Lecture 1* | PASS (routing/source envelope) |
| Athanasius on Incarnation | Relevant source excerpt | 0 exact lexical overlaps, despite 4 staged passages from *On the Incarnation* | FAIL |
| Gregory of Nyssa with duplicate author IDs | Do not select arbitrary author | 0 candidates, fail closed | PASS (safety only) |
| Photios absent from catalogue | Do not substitute another saint | 0 candidates | PASS (safety only) |
| Basil and Cyril comparison on Baptism | Relevant evidence from **both** authors | Only Cyril excerpt found | FAIL |
| Generic repentance question | Do not force a named author | Global scope, no automatic filter | PASS (routing only) |

The percentages measure gate conditions and lexical relevance on these eight questions, **not** answer quality. Several entries still carry `UNREVIEWED` provenance and `STAGED` import status.

## Root causes
1. Staging has only John Chrysostom's *Homilies on Matthew*, Homily I (72 indexed passages), with no direct match for `prayer` in the 68 substantive chunks. More relevant authenticated material is needed.
2. Four staged Athanasius excerpts come from *On the Incarnation*, Chapter I. None includes the lexical token `incarnation`, although §3 discusses the divine Word's appearing in a human body. This indicates a semantic retrieval gap, not necessarily absence of suitable evidence.
3. Basil's indexed staging work is *Hexaemeron*, Homily I, relevant to creation rather than baptism. The compare-Basil/Cyril question cannot be considered supported by both authors.
4. The speaker attribution gate correctly refuses automatically attributing dialogue utterances to the bibliographic author. Its review-record input is not yet independently verified against an authoritative review database.

## Release gate
The staging GitHub workflow now evaluates all 8 integration cases, publishes per-case evidence counts, saves a report artifact, and **fails the gate unless 8/8 pass**. This deliberately prevents treating incomplete evidence as a green light for production. Existing 18+19 author-scoping tests remain separate and still pass in direct connector-backed replay.

## Next genuine end-to-end milestone
To test generated Chat answers: construct a separate authenticated non-production application environment, with dedicated staging DB, isolated test user and quotas, correctly configured OpenAI key and source review checks. Exercise the actual `/api/chat` endpoint, validate claim-level grounding against real sourced passage locators and negative examples, then audit source cards and citation attribution. None of those checks is claimed complete here.

## Vercel preview isolation audit
Vercel project `orthodox-ai-24li` has a preview deployment for `experiment/patristic-catalog-author-v2-20261109`, but branch-specific preview environment-variable metadata contains **no DATABASE_URL override** for this branch. A generic `DATABASE_URL` and `DIRECT_URL` targeting `preview` are present. Their endpoints were deliberately not decrypted. Consequently the preview Chat endpoint could use a non-staging database, and invoking it would write conversation and quota records. **No HTTP Chat test was sent to that preview.** An isolated preview must have explicitly scoped staging credentials and its own safe test user before E2E execution.

This isolation concern is separate from the 5/8 read-only evidence tests and is a deployment blocker.

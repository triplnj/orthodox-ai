# OrthodoxAI — explicit-author resolution in a protected staging shadow

Date: 2026-11-09. **No production code path has been modified.** This is a guarded, read-only staging test.

## Why this matters

The measured eight-new-work benchmark (run 42620346809) found all-author Hit@10 = 7/8 versus expected-author-scoped Hit@10 = 8/8, with vector-only nDCG@10 above the fixed lexical reranker. Filtering by the *known author* was part of the benchmark experiment, **not** evidence that the current application already recognizes authors correctly.

The staging catalogue has **two distinct indexed author IDs with the same canonical name `St. Gregory of Nyssa`** (175 and 5 indexed passages), which must be flagged before author-ID-based filters are trusted.

## Shadow implementation

- Pure deterministic resolver: `scripts/patristics/resolve-author-scope.mjs`.
- Source catalogue evaluation: `scripts/patristics/shadow-author-routing-staging.mjs` (SELECT statements only, checks exact branch `br-spring-frost-assfzje6` and `LibraryStagingGuard`).
- Frozen cases: `tests/fixtures/patristic-author-router-12-shadow.json`.
- Tests: `tests/patristic-resolve-author-scope.test.mjs` and `tests/patristic-shadow-author-routing-staging.test.mjs`.
- One-time workflow: `.github/workflows/patristic-author-router-shadow-once.yml`, artifact `patristic-author-router-shadow-12`.

## Fail-closed rules

1. A *whole-phrase* audited name alias must match a canonical author actually represented by indexed source passages.
2. A known name with duplicate indexed author records **does not** select an arbitrary one. It requires catalogue deduplication or reviewed safe canonical-group handling.
3. No name specified → leave retrieval global. Unknown name explicitly specified → do **not** silently substitute another saint's sources.
4. Comparison requires exactly two recognized, unambiguous authors, and must not collapse to a single author filter.
5. Unqualified ambiguous names (e.g. 'Cyril', 'Gregory') are not eligible for automatic filtering.
6. A bibliographic author's identity is **not** automatically a dialogue speaker's identity. Statements in objection/answer dialogue still need passage-level attribution review.

## Limits and next gates

Twelve curated cases are a functional regression suite, not an independent author-detection accuracy benchmark. The resolver is not connected to live chat. Before enabling it anywhere outside shadow testing, review Serbian inflections, common spelling variants, overlapping short names, named authors absent from the library, dialogue-speech attribution, duplicate record normalization and a separate unseen question set.

The existing 30-question benchmark, 12-question holdout, eight-new-work QA, ranking algorithm, Neon production branch and live OrthodoxAI answers are unchanged.

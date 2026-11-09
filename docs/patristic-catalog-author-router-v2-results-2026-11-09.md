# OrthodoxAI — catalogue-driven author routing v2: measured staging shadow

Date: 2026-11-09  
**Verified GitHub Actions run:** https://github.com/triplnj/orthodox-ai/actions/runs/42624946441  
**Complete isolated tests:** https://github.com/triplnj/orthodox-ai/actions/runs/42624911415  
**Artifact:** `patristic-generic-catalog-author-shadow-16`, `catalog-author-shadow-16.json`

## Measured result

**16/16 frozen explicit-author routing cases passed** against the *actual read-only Neon staging catalogue* on branch `br-spring-frost-assfzje6`.

- Single-author, including Serbian variants: 6/6 correct
- Explicit two-author comparisons: 3/3 correct
- Unknown/unqualified author or invalid comparison: 5/5 safely rejected
- General, non-author mentions: 2/2 kept global

These numbers describe the **16 curated cases**, not unbiased population accuracy or verified attribution of theological quotations.

## Architecture

`scripts/patristics/catalog-author-resolver.mjs` is author-neutral. No saint names are embedded in its logic. Instead it reads:
- `LibraryAuthor.canonicalName` from the staged source catalog.
- `LibraryAuthor.nameVariants` where supplied.
- A separate, versioned reviewed alias dataset: `tests/fixtures/patristic-reviewed-author-aliases-v1.json`.

The current Neon `nameVariants` arrays are all empty, so the reviewed external registry supplies English and Serbian spellings for the five indexed saints in this pilot. **The registry still needs editorial review and coverage expansion**; it is not universal knowledge of all patristic authors. New authors can be added through reviewed catalogue data rather than a resolver source-code change.

Only whole-phrase matches are admitted. Any alias collision across distinct canonical names forces review. Name inference does not imply a correct answer.

## Duplicated author records

The staging catalogue contains two distinct indexed IDs named `St. Gregory of Nyssa`:
- `author_70a3fd40c93b35acefdd905186e79922` (five embeddings)
- `author_8acfb0ee0a6f046a3528db5d6587582f` (175 embeddings)

V2 resolves both as **one canonical author group with both record IDs**, never arbitrarily selects a single ID. No destructive database deduplication was performed. If a future retrieval filter uses this result, it must include both IDs or filter by exact canonical name.

## Expected safety behavior

- “What does Augustine of Hippo say?” → no filter; the staged Augustine pilot has zero embeddings.
- “What does St Maximus ...?” → no filter; source author absent from the indexed staging catalogue.
- “What did Cyril ...?” → no filter; insufficiently specific.
- “Compare Basil and Maximus ...” → review; do not downgrade to Basil-only.
- No author specified → global search.
- Explicit two recognized authors → both remain in the scope.

## Corrected failure during development

The first shadow CI (run `42624672899`) caught three false global routes caused by a capitalized-name expression erroneously expecting lowercase English question openings. Repaired in commit `7997339508fc9c0e031ff7519f8791ea80f4f90e`; tests and staging shadow subsequently both passed.

## Production isolation and next gate

No production code, live routing, paid embeddings, or Neon writes were performed by v2 author routing. The existing v1 resolver and all previous retrieval benchmark gold labels remain untouched.

Next gate: evaluate *generated-answer source fidelity* in isolation. Inspect factual/interpretive assertions against the cited passages and verify verbatim quotations, author versus dialogue speaker, objection versus endorsed statement, and whether the cited section directly supports the answer. Only after such tests and an untouched holdout may author-based filtering be considered for controlled live integration.

# Staging catalogue author resolver v2 — measured holdout
Date: 2026-11-09

## Scope
Staging branch: `br-spring-frost-assfzje6` in Neon project `winter-mountain-30736951`. Verified `LibraryStagingGuard` matched `PATRISTIC_LIBRARY_STAGING` prior to the change. No production DB or live-chat path was modified.

## Staging-only catalogue update
Populated `LibraryAuthor.nameVariants` on 6 rows representing 5 authors, without deleting existing variants: Athanasius of Alexandria (6 variants), Basil the Great (5), Cyril of Jerusalem (4), Gregory of Nyssa (4 on each of 2 records), John Chrysostom (4). Augustine of Hippo remained unindexed with no variants.

Duplicate indexed records for Gregory of Nyssa remain unresolved: 175 and 5 passages. Resolver fails closed for this name.

## Independent fixture replay against actual staging catalogue
The checked-in 18-case fixture `tests/fixtures/patristic-author-catalog-v2-holdout.json` was executed by evaluating the checked-in resolver source against the catalogue returned by a read-only Neon SELECT query.

- 18/18 correct on fixture-expected author-scope routing (100%).
- Serbian inflections and transliterated names matched where present in curated catalogue aliases.
- Duplicate-author records, unindexed authors, unknown saints, ambiguous names and partial comparisons returned no automatic filter when expected.
- No passage ranking, quoted-text attribution, doctrinal accuracy or generation was tested.
- This is a curated holdout with expected outcomes, not a blinded population accuracy estimate.
- GitHub Actions execution and job logs have **not** been independently verified. These measurements were performed directly via connector-backed staging SELECT and source evaluation, not a verified CI run.

## Remaining gates
1. Add regression tests for mixed known-and-unknown named authors, inflections not yet covered, overlapping names, and dialogue speaker attribution.
2. Inspect duplicate Gregory records and their editions before any merge or identity normalization.
3. Confirm GitHub Actions execution, artifact and non-production protection.
4. Validate live query handling in isolated staging only after routing cases are robust.

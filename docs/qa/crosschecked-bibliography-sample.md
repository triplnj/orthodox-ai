# Source-crosschecked author/work/role reference sample (2026-11-12)

This is a **small independently sourced sample** for evaluating the correctness of concrete author/work/role assertions, distinct from the unadjudicated 106-title New Advent index. The sample has **9 normalized assertions** with two cited external source entries each.

Sources were compared using published academic edition descriptions, bibliographies, specialist scholarship, and published edition catalogs. **These source records have not been independently human-peer-reviewed as a gold benchmark**. Source agreement is not a statistical guarantee and does not automatically establish a definitive critical edition.

## Records

- John of Damascus: `Fount of Knowledge`, `Dialectica`, `On Heresies`, `An Exact Exposition`; carefully distinguish parts from the whole; manuscript-unit grouping caveat recorded using the Bryn Mawr review.
- Basil of Caesarea: `On the Holy Spirit` attributed to Basil.
- Athanasius: `On the Incarnation` by Athanasius, **2011 translation** attributed to John Behr; do not convert the translator into an ancient author.
- Nicodemus: `Unseen Warfare` is his adaptation/editing of Scupoli's `Spiritual Combat`; Scupoli's source authorship separately identified.

## Metrics

`tests/bibliography-crosschecked-score.test.mjs` verifies referential integrity, separates work vs part vs translation vs adaptation, and measures exact claim precision and recall **only against these nine selected claims**. It deliberately penalizes wrong roles and wrong parent-work edges. It never asserts that current OrthodoxAI Chat answers have passed the benchmark.

To promote a new record, require evidence for role, work identity and source URL; mark uncertain/disputed manuscript relations instead of flattening them into a universal fact. Source records under `sourceRegistry` must not be treated as verbatim copied quotations.

**Production decision: remains NO-GO**, pending larger independently judged cases and actual authenticated Chat measurements.

# First external bibliography reference set — 2026-11-12

**Source:** [New Advent — The Fathers of the Church](https://www.newadvent.org/fathers/).

**Frozen dataset:** `docs/qa/external-fathers-index-benchmark.json` — **20 authors**, **106 externally listed author/title relations** and **10 negative attribution warnings**. Each record identifies its external source and distinguishes an index listing from an independently reviewed author-role assertion. The warnings include texts marked *spurious*, *pseudonymous* or *by another person* by the external index.

This is the first external benchmark, not a completed scholarly gold standard. It is independent of OrthodoxAI's generated answers and its internal seed catalogue, but it has only **one external bibliographic index** and its individual attributions have **not** been critically adjudicated. No model was used to label these records as verified historical facts.

## What the CI actually measures

- Dataset integrity: author count, title count, source references, and explicit negatives.
- Deterministic title/author pair matching, precision against this index, recall against this **selected index only**, duplicate handling, and warnings for explicitly disavowed authorship.
- A separate, honest count of name overlap with the currently reviewed internal catalogue. Name overlap is **not** source-proven author-work-role coverage.
- The evaluator never grants GO merely for a green test run or 100% coverage of this index.

## What is still needed for real GO

1. Two or more independently authoritative publications / critical editions supporting each selected author-work-role claim, or explicitly reviewed evidence from a recognized critical bibliography.
2. Adjudication of ambiguous, spurious and translation/edition/anthology relationships; written reviewer notes and record-level confidence.
3. A held-out real-response set for **20+ authors / 100+ claims**, run with real preview Chat answers and measured for false author, invented role, invented work, work-parent conflation, and meaningful citation.
4. No invented attributions in adversarial cases, at least 95% precision for supported claims, with recall tracked separately.

**Release decision remains NO-GO until those additional conditions are met.**

Run: `node tests/run-regressions.mjs bibliography-independent-benchmark`.

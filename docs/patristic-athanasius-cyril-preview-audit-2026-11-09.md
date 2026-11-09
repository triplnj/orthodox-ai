# OrthodoxAI — Athanasius / Cyril source quality gate

Date: 2026-11-09. **No database change, no OpenAI embedding call, no production activation.**

## Inspection of actual uploaded preview artifact

Inspected `patristic-two-new-works-source-preview.zip` (files `patristic-two-new-works.preview.json` and `patristic-two-new-works.summary.json`).

- Athanasius: 4 extracted paragraph nodes, 2,664 extracted characters, SHA256 `5fc6c2937cd3a934bf8262837718ded0f6fdac8d48b0426fc8c87398fe65f0cb`. Only `Source paragraph 004` (2,394 characters) is substantive authorial text. Paragraph 003 is a third-person section synopsis; paragraph 001 is the work title and paragraph 002 a decorative divider.
- Cyril: 13 extracted paragraph nodes, 8,088 extracted characters, SHA256 `5a9560e82b315d5c7a2b265ecc591aeff299c4f04fa17c24308bbeb9210cf8cf`. Substantive numbered sections 1–6 are source paragraphs 008–013. Paragraphs 001–007 are title lines, headings, attribution, an introductory rubric and biblical epigraph, not six independent authorial sections.

**Source-cleaning rule:** keep the Athanasius body and six Cyril numbered sections, retaining byte-level SHA256 from the original preview; preserve all discarded locators for audit. This avoids retrieval of titles and generic paratext as if they were theological teachings.

## Safe next phases

1. Clean script: `scripts/patristics/clean-new-works-preview.mjs`, tested by `tests/patristic-clean-new-works-preview.test.mjs`. It produces an editorial candidate (`NOT_STAGED`, `PENDING_EDITORIAL_REVIEW`), not an approved source.
2. Workflow `.github/workflows/patristic-new-works-preview-once.yml` now archives `patristic-two-new-works.clean-candidate.json` as a third artifact file after source extraction.
3. `tests/fixtures/patristic-new-works-8-question-plan.json` contains eight section-grounded English questions (three for Athanasius, five for Cyril); **passage IDs are intentionally null until an independently reviewed staging import**.
4. The original 30-question and 12-question holdouts, 61 source associations, v2 evidence review candidates and existing reranker remain untouched.
5. Before any staging import, review the original translated page and historical edition for accuracy and authorization. After staging, build embeddings only on the exact protected branch, evaluate against the eight questions, and audit citation fidelity.

**Limits:** The Athanasius selection is a single chapter section, not an adequate sample of the father's whole doctrine. Cyril's six numbered sections are sufficient for a modest catechetical pilot but not broad doctrinal claims.

**Lobster mode:** protect the chain of provenance, section integrity, speaker attribution, evidence, and citation before retrieval benchmarking.

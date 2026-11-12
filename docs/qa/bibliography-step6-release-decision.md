# OrthodoxAI — Bibliographic resolver Step 6/6: Architecture and release decision

**Decision: NO GO for production** · **Review date:** 2026-11-12 · **Target:** Draft PR #61 only.

## Evidence reviewed

- Step 5/6 synthetic matrix: 7 authors; 19 passing tests, of which 2 intentionally reproduce unsafe behavior. These tests do not constitute evidence that actual historical attributions are true.
- Actual QA answers for John of Damascus: one entirely ungrounded-looking bibliography; a generic refusal after search; a single primary-text match with other works omitted; and a subsequent response that listed two curated edition titles as `UNKNOWN` or “perhaps compiler/editor” despite insufficient evidence for that conclusion.
- Runtime diagnostics from PR preview: web discovery yielded 4 candidates, 3 pages were successfully retrieved, but only 1 bibliography claim passed the current validator. This measures coverage, not truthfulness.
- The current `validateClaims` gate checks literal source excerpt inclusion, name-of-work inclusion somewhere on the page, a source URL match, and parent-work string inclusion. It does **not** independently verify that the passage attributes the named work or the stated role to the requested person. A source about an author can pass through as though it were authored by them.

## Release-blocking defects

| ID | Severity | Observed/systemically reproduced defect | Required closure |
|---|---|---|---|
| BIB-P0-01 | P0 | A verbatim source excerpt can be paired with a model-generated **wrong author role**. | Evidence records must explicitly support author-to-work-to-role; unknown roles cannot be restated as original author/editor. |
| BIB-P0-02 | P0 | A page that merely **mentions** a work can be used as evidence of authorship. | Separate quoted author-role assertions from book reviews and incidental mentions; independent attribution confirmation for categorical statements. |
| BIB-P0-03 | P0 | Existing edition IDs and translations may be presented as independent authorial works or recast as uncertain original authorship. | Normalize work vs edition/translation vs collection component, with parent-work and alternate-title relations. |
| BIB-P1-04 | P1 | A strict literal-quotation check can reject legitimate scholarly attribution and produce a misleading partial bibliography. | Report coverage and missing evidence per work; never infer bibliographic completeness from retrieval count. |
| BIB-P1-05 | P1 | Arbitrary source-derived translated titles can be wrong; displayed links can be malformed. | Preserve sourced titles; use reviewed/attested title variants and consistent source URL rendering. |

## Architecture decision

**Retain** the reviewed, source-backed catalogue for established author-work-role relations; continue using broad live research for **discovery only**.

**Do not** use an LLM-extracted `AUTHOR`, `COMPILER`, `TRANSLATOR` or `ADAPTOR` role as a directly publishable categorical attribution based solely on a substring match. Treat an extract as a proposed **claim** pending proof.

Required next version:

1. **Work identity layer:** work ID distinct from edition ID, translation ID, collection ID, component ID; multilingual titles; `PART_OF`, `ADAPTATION_OF`, `TRANSLATION_OF` edges; do not conflate “St John Damascene on Holy Images” (edition title) with the original work.
2. **Attribution ledger:** author ID, work ID, **specific role**, precise source URL and reference, minimal supporting statement/excerpt, source kind, quote speaker/subject, `proposed | text-attested | reviewed | disputed | rejected` status.
3. **Two independent gates:** syntactic validation (already implemented) and evidence-entailment validation (currently missing). The second checks whether the quote supports the *same author-work-role proposition*, not merely that it appears online.
4. **Answer assembly:** response only from supported proposition records; language models can write prose but cannot invent work IDs, relationship edges, historical roles, page locators or a completeness claim. If only curated editions are known, present them as editions, **not** as separate original works, and do not guess the person's role.
5. **Metrics and audit:** record retrieval coverage, valid proposed claims, rejected semantic claims, source diversity, accepted claims, answer-level provenance, and failure category without user private text/secrets.

## Quantitative acceptance criteria before a GO decision

- A held-out, independently reviewed bibliography benchmark across **at least 20 distinct authors** spanning languages, centuries, and roles; at least 100 individual author-work-role claims, with ground-truth edition/source references.
- **100% of categorical bibliographic attributions** in the acceptance set link to directly supporting work-role evidence; **zero fabricated authors, titles, quotations, or parent-work edges** in the adversarial test set.
- At least **95% precision** on supported author-work-role claims; recall/coverage separately measured, not hidden by refusals.
- No classification of edition/translation titles as independently original works in the held-out hierarchy tests.
- Representative **real authenticated Preview Chat** answers and live-retrieval runs scored against the same benchmark; tests with mocked source pages alone never satisfy this gate.
- No regression in existing reviewed-catalogue behavior, authentication, per-user limits, payments, or source-fetch SSRF protections.
- Explicit human review of failed/uncertain cases and a fresh release decision before any merge to main.

## Current scorecard

| Signal | Result |
|---|---|
| Synthetic matrix | PASS: 19/19 (including known-gap characterization) |
| Cross-author historically ground-truthed benchmark | NOT RUN |
| Real-preview answer-level accuracy benchmark | NOT RUN |
| Semantic author-role entailment check | MISSING |
| Work/edition/translation semantic identity | INCOMPLETE |
| Release verdict | **NO GO** |

This report **completes project step 6/6 as an architectural assessment, not as a successful production launch**. PR #61 remains Draft; do not merge or promote to production without a new explicit authorization and successful GO review.

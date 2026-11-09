# OrthodoxAI — paragraph and dialogue context review queue

**2026-11-09 — Staging only.** The 30-question evidence annotations and their baseline measurement are frozen. This is a prioritized review queue, **not** a revised set of gold answers.

## Verified retrieval observations

The 30-question uploaded benchmark produced global reranked Hit@10 = 27/30 (90%). The misses, inspected against the current Neon staging excerpts and attribution metadata, are:

| Question | Observed hit | Existing evidence | Assessment / review target |
|---|---|---|---|
| `basil-07` (harmony and Maker) | `Source paragraph 011`, ordinal 0 at rank 4 | `Source paragraph 011`, ordinal 1 | **Same paragraph, different chunk.** Ordinal 0 develops the artwork/artist analogy; ordinal 1 continues the argument concerning the harmony of creation. Do not convert rank 4 into an exact hit. Evaluate passage segmentation and whether ordinal 0 should qualify as *supporting context* in a separately versioned editorial review. |
| `gregory-02` (soul surviving dissolution) | `Source paragraph 031` ordinal 1 at rank 8; `Source paragraph 033` ordinal 1 at rank 7; `Source paragraph 054` at rank 2 | `Source paragraph 005` and `007` | **Potentially incomplete positive-evidence coverage.** The later debate treats the soul, compositeness and dispersed bodily elements; a human reviewer must assess relevance to the precise question. The dialogue may contain Gregory's objections as well as Macrina's reasoning. Do not automatically label every later passage Macrina's endorsed teaching. |
| `gregory-09` (resurrection and dissolved body) | `Source paragraph 084` ordinal 2 at rank 1; `Source paragraph 085` ordinal 1 at rank 4; `Source paragraph 086` ordinal 0 at rank 10 | `Source paragraph 086` ordinal 1, `054` ordinal 0, `053` ordinal 0 | **Clear objection/answer boundary.** The tested 084–085 chunks are marked `OBJECTION / Gregory of Nyssa / TEXT_VERIFIED`; 086 ordinal 1 is `ANSWER / Macrina / TEXT_VERIFIED`. First chunk of 086 introduces Macrina's answer but is not itself the annotated evidence chunk. Never promote an objection to a direct answer. |

## Guardrails

1. Paragraph grouping produces a **nearby-chunk diagnostic**, **never** an exact passage-level hit or a doctrinal validation.
2. Speaker changes and `UNREVIEWED` attribution anywhere in a grouped paragraph force manual review.
3. Keep the original vector and reranked top-ten rankings untouched. Do not retroactively inflate Hit@3, Hit@5 or Hit@10.
4. Proposed evidence additions must go to a separate, versioned review file. Only a later independent editorial process may approve a v2 dataset.
5. Do not put research-only texts or dialogue-attribution heuristics into production before accuracy and citation-faithfulness review.

## Implemented inspection

- `scripts/patristics/paragraph-context-diagnostic.mjs`: read-only diagnostic that labels exact hits, same-paragraph near misses and unlabelled paragraphs.
- `scripts/patristics/inspect-30-paragraph-context-staging.mjs`: verifies the protected Neon staging marker, corpus count and content hashes, then retrieves neighboring chunks and speaker/statement metadata without database writes.
- `.github/workflows/patristic-evidence-30-evaluation-once.yml`: archives `patristic-evidence-30-context.json` alongside the existing comparison and failure audit.
- Unit tests cover mixed speaker boundaries, objection-only snippets, exact-vs-nearby hits, branch guard, and content drift.

This is a **diagnostic capability**, not proof of theological correctness.

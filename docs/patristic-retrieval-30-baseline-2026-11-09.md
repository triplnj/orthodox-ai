# OrthodoxAI — English evidence retrieval baseline (2026-11-09)

## Scope and provenance
Analysis of user-supplied GitHub Actions artifact `patristic-evidence-30-evaluation.zip` (JSON from the 30-question staging-only test). This is an immutable **measurement snapshot**, not a theological certification or a permission to activate staging content in production. Corpus: 285 passages, 281 embedded; 30 English questions, 61 provisional source-evidence links.

## Measured performance

| Retrieval scope | Ranking | Hit@3 | Hit@5 | Hit@10 | Recall@3 | Recall@5 | Recall@10 | nDCG@10 | MRR |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All authors | Vector baseline | 0.86667 | 0.90000 | 0.90000 | 0.61667 | 0.73333 | 0.80000 | 0.68024 | 0.71778 |
| All authors | Current reranker | 0.86667 | 0.90000 | 0.90000 | 0.65000 | 0.70000 | 0.78333 | 0.68627 | 0.71944 |
| Expected author | Vector baseline | 0.86667 | 0.90000 | 0.93333 | 0.63333 | 0.75000 | 0.88333 | 0.70334 | 0.72194 |
| Expected author | Current reranker | 0.90000 | 0.90000 | 0.90000 | 0.68333 | 0.71667 | 0.86667 | 0.70729 | 0.72778 |

The current reranker yields only marginal nDCG/MRR gains; it **reduces recall@10** relative to the original vector ordering. Do not advertise these figures as theological correctness.

## Consistent global top-ten misses (current reranker)

| Question | Topic | Observation and distinct hypothesis |
| --- | --- | --- |
| `basil-07` | Created harmony and the Maker | Retrieved `Source paragraph 011` **ordinal 0** in position 4, but gold evidence links `011` **ordinal 1**, not the retrieved segment. The chunks are adjacent and the first begins an artisan analogy. Also retrieved another Basil paragraph 018. Source-boundary / gold-completeness issue requires manual adjudication. |
| `gregory-02` | Soul surviving dissolution | Retrieval consistently surfaced paragraphs 031–033 and 054 (substantive discussion of incomposite soul/body dissolution) while reference labels only select the early dialogue's paragraph 005 and 007. This may represent overly narrow reference evidence, not pure retrieval failure. |
| `gregory-09` | Resurrection after bodily dissolution | Retrieval surfaced the argumentative neighborhood in paragraphs 083–087 (including 086 ordinal 0) while gold evidence selects paragraph 086 **ordinal 1**, paragraph 054, and paragraph 053. This may be a chunk-boundary / relevance-annotation problem; distinguish objection from response. |

**Important:** no relevance labels were changed after seeing these results; this benchmark remains a fair baseline for comparisons.

## Highest-priority regressions

The current reranker reduced nDCG@10 substantially in all-author retrieval for:

| Question | Vector | Reranked | Change |
| --- | ---: | ---: | ---: |
| `chrysostom-06` | 0.60420 | 0.35584 | -0.24836 |
| `chrysostom-10` | 0.59504 | 0.41312 | -0.18192 |
| `gregory-03` | 0.63093 | 0.50000 | -0.13093 |
| `gregory-04` | 0.52130 | 0.41312 | -0.10818 |

For `chrysostom-06`, the relevant paragraph 020 is only #4 globally after reranking, and for `chrysostom-10`, direct paragraph 058 is #7 globally. Preserve original rank and context in future answer-citation evaluation.

## Next implementation requirements

1. **Do not change the existing reranker or the 30 gold annotations to inflate this result.**
2. Independently judge previously unlabelled neighboring paragraphs (and attribution status) before creating **a versioned v2 dataset**. Maintain v1 as an immutable comparison.
3. Compare passage-level ranking to **paragraph-level grouping** (multiple ordinal chunks from one source paragraph) as a *separate diagnostic*, not as a retroactive metric improvement.
4. Add an **independent holdout** set of English questions on additional source material before selecting or promoting a new architecture.
5. Evaluate citation faithfulness, argumentative/speaker boundaries and uncertainty separately from retrieval metrics before any production integration.

No source text is declared author-approved doctrine by this report. This work is isolated from production.

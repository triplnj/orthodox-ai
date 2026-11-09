# OrthodoxAI: eight new-work retrieval questions — first measured audit

**Run:** https://github.com/triplnj/orthodox-ai/actions/runs/42620346809  
**Artifact:** `patristic-two-new-works-staged-unreviewed`, `new-works.eight-question-qa.json`  
**Frozen input:** eight questions, ten source sections, Neon branch `br-spring-frost-assfzje6`, 295 passages of which 291 indexed.  
**Status:** measured retrieval of pre-annotated sections; **NOT an evaluation of generated theological answers**.

## Headline scores

| Retrieval scope | Ranking | Hit@10 | nDCG@10 | Reciprocal rank |
|---|---|---:|---:|---:|
| All authors | Vector only | 87.5% (7/8) | 0.82887 | 0.81250 |
| All authors | Fixed lexical reranker | 87.5% (7/8) | 0.78273 | 0.75000 |
| Expected author known | Vector only | 100% (8/8) | 0.89137 | 0.85417 |
| Expected author known | Fixed lexical reranker | 100% (8/8) | 0.84523 | 0.79167 |

The fixed reranker does not improve top-ten recall and **reduces nDCG@10 by 0.04614**, both globally and author-filtered. With only 8 questions this is a diagnostic regression, not a claim of statistical significance.

## Exact first relevant rank for each frozen target passage

| Question | Global vector | Global reranked | Author-scoped vector | Author-scoped reranked |
|---|---:|---:|---:|---:|
| `athanasius-inc-01` | 1 | 1 | 1 | 1 |
| `athanasius-inc-02` | **outside top 10** | **outside top 10** | 3 | 3 |
| `athanasius-inc-03` | 1 | **2** | 1 | **2** |
| `cyril-cat-01` | 2 | 2 | 2 | 2 |
| `cyril-cat-02` | 1 | 1 | 1 | 1 |
| `cyril-cat-03` | 1 | 1 | 1 | 1 |
| `cyril-cat-04` | 1 | 1 | 1 | 1 |
| `cyril-cat-05` | 1 | 1 | 1 | 1 |

In global baseline, the expected author occupies rank 1 for 7/8 questions, while the exact target passage is rank 1 for 6/8. Reranking lowers exact passage rank-1 coverage to 5/8. These are evidence-location metrics, not standalone author classification metrics.

## Specific defects and review recommendations

### A. Cross-author ambiguity — `athanasius-inc-02`

Prompt: *Why does Athanasius return to the teaching about creation before explaining the Incarnation?*

- Global baseline: top ranks **Gregory of Nyssa** (paragraphs 074, 039) and **Basil the Great** (paragraphs 008, 005); Athanasius `§1` at rank 5 and `§4` at rank 8. The annotated `§3` does not appear in the first ten.
- With known-author filtering: Athanasius `§1` at rank 1, `§4` at rank 2, annotated `§3` at rank 3.
- **Annotation concern verified against text:** `§3` says the explanation requires recalling what has been said before, to understand why the incorporeal Word assumed a body for salvation. `§4` explicitly says to begin with creation, because the same Word made and renews creation. Hence a carefully sourced answer may need **both §3 and §4**, and `§4` can be the more direct reference for the exact wording. The frozen original metric must not be edited; any proposed multi-section answer label requires independent versioned adjudication.

### B. Reranker promotion of lexical neighbors — `athanasius-inc-03`

- `§1` answers what prior subjects were treated (idols, the Word's divinity and providence) and is first under vector similarity.
- The lexical reranker promotes `§3` instead, putting the original direct target `§1` second globally and in author-scoped results.
- This demonstrates why lexical overlap alone cannot override source/argument function.

### C. Nearby non-equivalent answer — `cyril-cat-01`

- Target section `§1` is second; `§2` ranks first in both methods.
- Both concern preparation for baptism, but cannot be assumed interchangeable as evidence without reviewing their respective claims. Propose paragraph-level editorial relevance review, **not automatic relabeling**.

### D. Author routing versus theological truth

The controlled author-filter experiment retrieves the annotated target in all eight cases, but this does not mean the system can autonomously identify the correct author in unseen text. Explicit author names in questions can be parsed and used as trusted search filters **only after exact catalogue matching and ambiguity checks**; author-agnostic or comparative questions must remain global/multi-author.

**Do not alter** `scripts/patristics/rerank-retrieval.mjs`, original 30-question benchmark, 12-question holdout, or production chat based solely on this eight-question set.

## Code-level safeguards

`scripts/patristics/audit-eight-new-works-report.mjs` validates archived report identity, source IDs, relevance flags, first-hit ranks and per-question regressions. Its results are diagnostics only, with unit tests in `tests/patristic-eight-new-works-report-audit.test.mjs`.

## Next evidence-quality gate

1. Independently adjudicate the multi-section Athanasius §3–§4 case and the Cyril §1–§2 case, keeping v1 untouched.
2. Add author-resolver shadow evaluation with explicit-author, no-author and comparison queries across all five available authors. Require exact catalogue matches, refuse fuzzy/substring aliases and never infer a doctrinal speaker from a work's author.
3. Add source-faithfulness QA using actual synthesized answers on staging only. Compare assertions and any quotations with cited source text, distinguish dialogue speakers, and reject fabricated quotations.
4. Require a new untouched independent corpus/holdout before switching production retrieval routing or adopting a new reranker.

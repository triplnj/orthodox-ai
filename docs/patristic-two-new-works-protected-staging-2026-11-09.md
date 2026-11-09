# OrthodoxAI — new works in protected staging, stage + embedding + English QA

Date: 2026-11-09. All actions are scoped to Neon project `winter-mountain-30736951`, **staging branch** `br-spring-frost-assfzje6`. Production branch and live chat must not be modified.

## Source and rights verification

- Athanasius, *On the Incarnation of the Word*, Chapter I: 1892 NPNF II/IV (Archibald Robertson), public-domain historical English edition. Wikisource volume copyright marker and historical text inspected.
- Cyril of Jerusalem, *Catechetical Lecture I*: 1894 NPNF II/VII (Edwin Hamilton Gifford), public-domain historical English edition. Wikisource volume copyright marker and numbered sections inspected.
- Original archive: `patristic-two-new-works-source-preview.zip`; byte hashes pinned in `scripts/patristics/prepare-pinned-new-works-staging.mjs`.
- **Correction:** Wikisource Athanasius Chapter I contains §1, §2, §3 and §4 inside a single HTML paragraph. Four separate historical source locators are now restored losslessly. Cyril contains six independently numbered sections.
- Only **10** numbered source sections are staged: 4 Athanasius + 6 Cyril. Paratext, headings and epigraphs are excluded from the index.

The public-domain translation rights have been checked for staging; **theological interpretation, speaker identification and citation faithfulness are NOT editor-approved**. The stage command leaves `LibraryEdition.importStatus=STAGED` and new passages marked `ocrQuality=UNREVIEWED`.

## One-time controlled job

Workflow: `.github/workflows/patristic-two-new-works-stage-once.yml`

1. Check exact staging branch secret plus Neon `LibraryStagingGuard`.
2. Refetch historic source pages and build immutable source-preview hash.
3. Remove non-authorial paratext and restore original numbered sections.
4. Validate exact ten section SHA256 values and expected edition identities; fail closed on drift.
5. Use transactional `stageSourceBatch` through `stage-pinned-new-works-staging.mjs` to write only the protected staging branch.
6. Use guarded `index-two-new-works-staging.mjs` to embed precisely 10 new sections. Conservative maximum budget **US $0.05**.
7. Use `evaluate-eight-new-works-staging.mjs` to compare **unchanged** original vector ranking and English reranker with 8 source-anchored new-author questions, both global and author-scoped.
8. Save a JSON artifact `patristic-two-new-works-staged-unreviewed` with staging IDs, indexing count and 8-question QA results.

Expected complete staging corpus: **295 passages, 291 embeddings** (original 285 / 281 plus 10 / 10). The original 30- and 12-question tests are pinned to the historical 281 indexed passages via `frozen-baseline-corpus.mjs`, ensuring they remain comparable to prior measurements. The old reranking algorithm itself is unchanged.

## Interpretation limits

- Successful staging/embedding **does not activate any source** in production.
- A section hit is evidence-location quality, not a theological correctness verdict.
- These two new editions are deliberately small pilot excerpts. They cannot validate coverage of entire patristic authors, and cross-work generalization needs more source diversity.
- Do not rewrite the 30/12-question baseline or original v2 proposal annotations after observing new results.
- If source bytes differ, history proves a different manuscript was fetched: investigate, do not relax SHA checks.
- If workflow fails, inspect logs and do not assume new texts were imported or indexed.

**Lobster mode:** independently auditable chain from source edition and rights through source boundaries, immutable hashes, exact section citations, bounded embeddings and measured cross-work retrieval.

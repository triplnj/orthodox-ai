# OrthodoxAI: novel patristic works — source preview gate (2026-11-09)

## Objective

Verify provenance and extraction quality for works not represented in the existing 281 embedded library passages before evaluating cross-author retrieval. This experiment is **not** a new embedding or doctrinal accuracy measurement.

## Source candidates (nineteenth-century English translations)

1. **St Athanasius of Alexandria**, *On the Incarnation of the Word*, Chapter 1, NPNF Series II, Volume IV (1892), translated by Archibald Robertson. Primary transcription: https://en.wikisource.org/wiki/Nicene_and_Post-Nicene_Fathers:_Series_II/Volume_IV/Incarnation_of_the_Word/On_the_Incarnation_of_the_Word/Chapter_1
2. **St Cyril of Jerusalem**, *Catechetical Lecture 1*, NPNF Series II, Volume VII (1894), translated by Edwin Hamilton Gifford. Primary transcription: https://en.wikisource.org/wiki/Nicene_and_Post-Nicene_Fathers:_Series_II/Volume_VII/S._Cyril/Lecture_1

Source text is fetched at workflow runtime directly from Wikisource MediaWiki API. Metadata includes work, author, translator, edition, original URL, numbered sections, paragraph boundaries and SHA-256 digests. Transcriptions require comparison to historical edition scans and human editorial approval for rights and attribution.

## Controlled execution

- Script: `scripts/patristics/preview-new-works-staging.mjs`.
- Tests: `tests/patristic-new-works-preview.test.mjs`.
- One-time workflow: `.github/workflows/patristic-new-works-preview-once.yml`.
- Artifact: `patristic-two-new-works-source-preview`, including paragraphs and provenance.
- **No database credentials** are supplied to this workflow. No database access, no indexing, no paid API calls, and no live-chat integration.
- The source output has `rightsStatus=PENDING_EDITORIAL_REVIEW` and `importStatus=PREVIEW_NOT_STAGED` and must not be passed into an approved ingestion command.

## Next guarded gates

1. Inspect preview text and source paragraph alignment; check translation integrity and right-to-use evidence.
2. Build a reviewed manuscript for staging only; require a hash and explicit approval before any DB write.
3. Add embeddings only on the approved staging branch `br-spring-frost-assfzje6`, after verifying the `LibraryStagingGuard`.
4. Construct an independently frozen English question set on the genuinely new works. Include intentional counterexamples: St Athanasius on the Incarnation vs cosmology, St Cyril on catechesis vs baptismal interpretation.
5. Compare original vector baseline with the *unchanged* reranker, record passage-level attribution and citation-faithfulness separately, and keep production isolated.

**Lobster mode:** source identity, accurate text, authorial voice, argumentative context and traceable citations are distinct checks. A passing workflow or retrieved excerpt is not evidence of doctrinal accuracy.

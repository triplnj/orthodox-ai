# OrthodoxAI — task 2: Gregory of Nyssa identity and dialogue speaker safety

Date: 2026-11-09
Repository branch: `experiment/patristic-catalog-author-v2-20261109`
Database: Neon protected staging `br-spring-frost-assfzje6`
Production changes: **NONE**

## Verified work identity

There are **two** separate `LibraryAuthor` rows with `canonicalName=St. Gregory of Nyssa` and **two** `LibraryWork` records of the work *On the Soul and the Resurrection*. One edition (New Advent) contains 175 embedded paragraphs and the second (St. Nina Orthodox Church) contains five. These are the same **bibliographical work** but separate source transcriptions, source boundaries and publication environments; that distinction is retained.

Primary witnesses:
- https://www.newadvent.org/fathers/2915.htm
- https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/

A reviewed identity manifest pins both author, work and edition IDs and URLs, source passage counts and the policy of **no database merge or deletion**. The new `resolveReviewedLogicalAuthor` constructs one ephemeral logical author for routing, then expands it back to both real IDs at retrieval time. Every other duplicate remains fail-closed, every original record remains intact, and a changed catalogue fails review.

## Dialogue attribution

The text is a dialogue **written by Gregory** in which **Macrina** and Gregory speak. Bibliographic work authorship does NOT make every utterance Gregory's.

The following initial speaker assignments are evidence-anchored and verified by exact passage ID, source matched text and SHA-256:

1. Macrina, `passage_d451a2cb7b4381904cece710504c14ff`, New Advent, paragraph 003. Text contains "asked the Teacher"; the source introduces the Teacher as Macrina (Gregory's sister).
2. Gregory, `pilot_gregory_opening_paragraph_4`, St. Nina opening dialogue. Its speaker follows directly from the narrator "With a heart still fermenting with my pain, I asked" in the preceding paragraph.

A trusted review record (checked in source, not the request) with exact passage ID, passage content SHA-256, edition ID, locator and source-match status is now mandatory to allow `speakerVerified=true`. Arbitrary `reviewRecordId` strings no longer suffice.

Two explicitly unapproved cases remain denied:
- `pilot_gregory_macrina_first_response`: only PARTIAL_TEXT_MATCH; transcription uses a variant wording.
- `passage_3caf70e65932fa3b6f83a9452cb8a30f`: narrator reports a biblical quotation of the Apostle; it must not be treated as a statement coined by Gregory.

**No reviewed speaker assignment implies permission to publish a direct quotation.** Both reviewed voices have `mayQuoteDirectly=false`; the 178 other passages have no positive speaker verification by default. This policy is intentional and safe.

## Staging retrieval integration

The existing staging `integrate-evidence-staging.mjs` now routes via the reviewed logical identity overlay. For Gregory it admits only **six** previously FULL_NORMALIZED_MATCH source snippets from the real 297-passage audit. These six are pinned by passage ID AND content SHA-256, and are not wholesale promoted to authenticated/publication-ready source status. Other authors' eight preexisting test cases remain.

A ninth integration question exercises Gregory's reviewed logical identity directly. The older `gregory-duplicate` case is updated to test expected safe resolution instead of obsolete blanket blocking.

## Measured CI evidence

- `https://github.com/triplnj/orthodox-ai/actions/runs/42675594931`: success, 8/8 independent routing/speaker safety tests on the live staging database; source edition records preserved.
- `https://github.com/triplnj/orthodox-ai/actions/runs/42676044558`: success on tests and report generation, 9 integration checks executed but one legacy fixture still expected blocked Gregory (8/9); fixed in commit `f1244782135524b416cf2fc32afc28c0a7bd723f`.
- Latest integrated 9/9 re-run: check newest workflow artifacts and result before declaring accepted.
- Source downloads can time out at the external Augustine provider. Retry and fail-closed-with-diagnostics logic added; no unavailable source may be silently certified.

## Scope boundary and next phase

This task closes the **duplicate-identity architecture and trustworthy speaker-gate design** for the current staging corpus, without changing DB rows. It does **not** claim independent full speaker attribution of all 180 Gregory chunks, exact-line quotation authority, or answer-level theological verification. Unreviewed passages are denied positive attribution, and 73 entries across the library remain source-quarantined from task 1. The future Chat E2E environment must use the trusted manifests server-side; nothing from a user request or LLM output may be accepted as an editorial review record.

Production remains unchanged. Task 3 is isolated Preview DB credentials and wiring the tested resolver to non-production Chat.

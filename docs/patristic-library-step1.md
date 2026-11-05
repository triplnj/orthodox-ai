# Patristic library — Step 1 (isolated staging)

## Purpose

Extend, never replace, the existing quotation database and chat retrieval.
The new library supports source corpora PG, PL, Philokalia,
MODERN_ORTHODOX, CURATED_OTHER. It does **not** assume the former three
contain later Orthodox authors, nor that their entire contents are currently
indexed.

## Implemented

- Offline-only text segmenter: `src/lib/patristics/library/chunk-document.ts`
- Additive SQL schema: `scripts/patristics/sql/001_additive_library.sql`
- Isolated regression test: `tests/patristic-library-isolation.test.mjs`
- The existing Prisma schema, existing PatristicQuote table,
  chat route, streaming pipeline and current source discovery are unchanged.
- SQL applied **only** to Neon branch `patristic-library-staging-2026-11-05`
  (`br-spring-frost-assfzje6`); schema presence checked there.
- The SQL is deliberately NOT part of Prisma's automatic migration directory.

## Conditions before import

1. Record canonical author and verified work attribution. Historical editions
   may contain wrongly attributed or disputed works.
2. Confirm license/permission for the exact edition and any modern translation.
   Public-domain source text does not imply its modern translation is free.
3. Preserve printed locator (volume, PG/PL column, chapter, section) and
   scan URL separately. Never infer printed columns from PDF scan-page index.
4. Stage document passages with importStatus STAGED and leave the
   text unavailable to live retrieval until review sets status ACTIVE.
5. Generate `text-embedding-3-small` 1536-dimension embeddings for passage
   texts; test author/work filtering and adjacent passage expansion.
6. Perform retrieval relevance and source-attribution evaluation on a fixed
   suite before any feature flag enables the new search in production.
7. Verify existing streaming (SSE delta) and existing patristic source cards
   with an authenticated end-to-end test before shipping an integration.

## Not done

- No PG, PL, Philokalia or modern Orthodox editions have been imported
  into the new tables.
- No background indexing jobs, live semantic search, reader UI or new
  answer-generation path is wired up.
- Automated tests are authored but not yet independently executed.
- Staging data must not be treated as production evidence.

## Rollout

Introduce a read-only, independently tested search function, behind a default-off
flag. Compare retrieval results against existing behavior. Enable only after
a passing regression suite, verified attribution and rollback procedure.

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
- Source discovery registry (not automatically ingested): `src/lib/patristics/library/source-registry.ts`
- Standalone ACTIVE-only semantic search (not wired into chat): `src/lib/patristics/library/search-library.ts`
- Work import manifest planner: `src/lib/patristics/library/prepare-work-import.ts`
- Atomic multi-section work staging writer: `src/lib/patristics/library/stage-work-import.ts`
- Offline import planner with mandatory rights/attribution review: `src/lib/patristics/library/prepare-import.ts`
- Transactional idempotent staging writer: `src/lib/patristics/library/stage-import.ts`
- Bounded, injection-based embedding worker (1536 dimensions, STAGED editions only): `src/lib/patristics/library/stage-embeddings.ts`
- Isolated regression test: `tests/patristic-library-isolation.test.mjs`
- GitHub Actions isolated testing: `.github/workflows/patristic-library-isolated-tests.yml`
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

- A **four-passage pilot** from the 1893 NPNF English translation of Gregory of Nyssa's\n  *On the Soul and the Resurrection* was staged on the isolated Neon branch.\n  Source: https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/\n  Locators: opening dialogue, paragraphs 1–3, and separately paragraph 4. SHA-256 of stored text verified for all 4 passages.\n  Pilot lexical query with the term 'Teacher' returned two matching passages and provenance. The second locator demonstrates separate section storage.\n  The staging edition remains STAGED, with 0 embeddings and 0 ACTIVE passages.\n- No full PG, PL or Philokalia volumes, or modern Orthodox editions, have\n  been loaded into the new tables. Import and embedding modules are not\n  connected to a scheduled job or public API.
- No background indexing jobs, reader UI or new answer-generation path is wired up.\n  Read-only vector search exists as an isolated module, but no actual vector\n  embeddings have been generated for the staged sample.
- Automated tests are authored and CI workflow added; only mark tests as passed
  after reviewing an actual CI test run.
- Staging data must not be treated as production evidence.

## Rollout

Introduce a read-only, independently tested search function, behind a default-off
flag. Compare retrieval results against existing behavior. Enable only after
a passing regression suite, verified attribution and rollback procedure.

## Full-work completeness rule

The new work planner preserves separate section locators, rejects duplicate sections and edition-metadata mismatches, and uses an explicit expected section manifest to distinguish COMPLETE_MANIFEST from PARTIAL_SAMPLE. This label is derived from the supplied manifest, not a guarantee that the source edition itself was complete. Before approving a full-work import, compare the manifest against the printed table of contents. The staging writer accepts at most 2500 passage chunks per transaction; larger volumes should be split into verified units.

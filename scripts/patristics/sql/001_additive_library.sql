-- OFFLINE/STAGING MIGRATION ONLY. NOT WIRED INTO CHAT OR AUTOMATIC PRISMA MIGRATION.
-- Extend the existing patristic quote corpus; do not alter or remove any existing tables.
-- Apply to a dedicated Neon branch first. Text licensing must be reviewed before importing.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "LibraryAuthor" (
  "id" text PRIMARY KEY,
  "canonicalName" text NOT NULL,
  "nameVariants" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "LibraryWork" (
  "id" text PRIMARY KEY,
  "authorId" text NOT NULL REFERENCES "LibraryAuthor" ("id"),
  "title" text NOT NULL,
  "titleVariants" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "workType" text NOT NULL DEFAULT 'UNSPECIFIED',
  "authenticity" text NOT NULL DEFAULT 'UNREVIEWED',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("authorId", "id")
);

CREATE TABLE IF NOT EXISTS "LibraryEdition" (
  "id" text PRIMARY KEY,
  "workId" text NOT NULL REFERENCES "LibraryWork" ("id"),
  "corpus" text NOT NULL CHECK ("corpus" IN
    ('PG', 'PL', 'PHILOKALIA', 'MODERN_ORTHODOX', 'CURATED_OTHER')),
  "editionTitle" text NOT NULL,
  "originalLanguage" text NOT NULL,
  "sourceUrl" text NOT NULL CHECK ("sourceUrl" LIKE 'https://%'),
  "translator" text,
  "licenseNote" text NOT NULL,
  "importStatus" text NOT NULL DEFAULT 'STAGED'
    CHECK ("importStatus" IN ('STAGED', 'REVIEWED', 'ACTIVE', 'REJECTED')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workId", "id")
);

CREATE TABLE IF NOT EXISTS "LibraryPassage" (
  "id" text PRIMARY KEY,
  "editionId" text NOT NULL REFERENCES "LibraryEdition" ("id"),
  "locator" text NOT NULL,
  "ordinal" integer NOT NULL CHECK ("ordinal" >= 0),
  "content" text NOT NULL CHECK (length("content") > 0),
  "contentSha256" text NOT NULL,
  "language" text NOT NULL,
  "ocrQuality" text NOT NULL DEFAULT 'UNREVIEWED',
  "embedding" vector(1536),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("editionId", "locator", "ordinal")
);

CREATE INDEX IF NOT EXISTS "LibraryPassage_edition_ordinal_idx"
  ON "LibraryPassage" ("editionId", "ordinal");
CREATE INDEX IF NOT EXISTS "LibraryPassage_embedding_hnsw_idx"
  ON "LibraryPassage" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "LibraryEdition_corpus_status_idx"
  ON "LibraryEdition" ("corpus", "importStatus");
CREATE INDEX IF NOT EXISTS "LibraryWork_author_idx"
  ON "LibraryWork" ("authorId");

-- Retrieval must restrict to approved editions (importStatus='ACTIVE')
-- and to the named author whenever a question specifies one.
-- Related passages are expanded by editionId and adjacent ordinal.
-- This migration does NOT change existing PatristicQuote and PatristicQuoteSource.

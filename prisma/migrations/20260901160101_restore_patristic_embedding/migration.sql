-- This is an empty migration.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "PatristicQuote"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
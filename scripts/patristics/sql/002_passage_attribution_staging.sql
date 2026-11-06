-- Additive, isolated staging-only attribution metadata.
-- Do not mutate LibraryPassage, PatristicQuote, or any existing live tables.
-- Annotate the TEXTUAL SPEAKER separately from the attributed work author.
CREATE TABLE IF NOT EXISTS "LibraryPassageAttribution" (
  "passageId" text PRIMARY KEY REFERENCES "LibraryPassage"("id") ON DELETE CASCADE,
  "speakerName" text,
  "speakerRole" text NOT NULL DEFAULT 'UNDETERMINED'
    CHECK ("speakerRole" IN ('NARRATOR','DIALOGUE_SPEAKER','REPORTED_SPEAKER','UNDETERMINED')),
  "statementKind" text NOT NULL DEFAULT 'UNDETERMINED'
    CHECK ("statementKind" IN ('NARRATION','QUESTION','OBJECTION','ANSWER','TEACHING','QUOTATION','UNDETERMINED')),
  "attributionStatus" text NOT NULL DEFAULT 'UNREVIEWED'
    CHECK ("attributionStatus" IN ('UNREVIEWED','TEXT_VERIFIED','DISPUTED')),
  "evidenceUrl" text NOT NULL CHECK ("evidenceUrl" LIKE 'https://%'),
  "evidenceNote" text NOT NULL,
  "reviewedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "LibraryPassageAttribution_kind_idx"
  ON "LibraryPassageAttribution" ("statementKind","attributionStatus");

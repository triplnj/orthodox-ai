-- Staging-only explicit dialogue adjacency, independent of chunking/locator.
-- Never assume consecutive source records imply consecutive spoken turns.
CREATE TABLE IF NOT EXISTS "LibraryDialogueTurnLink" (
  "fromPassageId" text NOT NULL REFERENCES "LibraryPassage"("id") ON DELETE CASCADE,
  "toPassageId" text NOT NULL REFERENCES "LibraryPassage"("id") ON DELETE CASCADE,
  "relation" text NOT NULL CHECK ("relation" IN ('QUESTION_FOLLOWED_BY_REPLY')),
  "evidenceUrl" text NOT NULL CHECK ("evidenceUrl" LIKE 'https://%'),
  "reviewed" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("fromPassageId","toPassageId","relation"),
  CHECK ("fromPassageId" <> "toPassageId")
);
CREATE INDEX IF NOT EXISTS "LibraryDialogueTurnLink_reply_idx"
  ON "LibraryDialogueTurnLink" ("toPassageId");

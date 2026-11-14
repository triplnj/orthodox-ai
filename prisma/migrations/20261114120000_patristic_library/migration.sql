-- Additive, isolated library migration: no changes to existing chat/auth/payment tables.
CREATE TABLE "LibraryAuthor" (
 "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
 "originalName" TEXT, "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "period" TEXT, "language" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LibraryAuthor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LibraryAuthor_slug_key" ON "LibraryAuthor"("slug");
CREATE INDEX "LibraryAuthor_name_idx" ON "LibraryAuthor"("name");

CREATE TABLE "LibraryWork" (
 "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL,
 "originalTitle" TEXT, "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "language" TEXT, "genre" TEXT, "externalIds" JSONB,
 "survivalStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "parentWorkId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LibraryWork_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LibraryWork_slug_key" ON "LibraryWork"("slug");
CREATE INDEX "LibraryWork_title_idx" ON "LibraryWork"("title");
CREATE INDEX "LibraryWork_status_idx" ON "LibraryWork"("status");
CREATE INDEX "LibraryWork_parentWorkId_idx" ON "LibraryWork"("parentWorkId");
ALTER TABLE "LibraryWork" ADD CONSTRAINT "LibraryWork_parentWorkId_fkey" FOREIGN KEY ("parentWorkId") REFERENCES "LibraryWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LibraryAttribution" (
 "id" TEXT NOT NULL, "authorId" TEXT NOT NULL, "workId" TEXT NOT NULL,
 "role" TEXT NOT NULL DEFAULT 'AUTHOR',
 "authenticity" TEXT NOT NULL DEFAULT 'UNDETERMINED', "note" TEXT,
 CONSTRAINT "LibraryAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LibraryAttribution_authorId_workId_role_key" ON "LibraryAttribution"("authorId","workId","role");
CREATE INDEX "LibraryAttribution_workId_idx" ON "LibraryAttribution"("workId");
ALTER TABLE "LibraryAttribution" ADD CONSTRAINT "LibraryAttribution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "LibraryAuthor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryAttribution" ADD CONSTRAINT "LibraryAttribution_workId_fkey" FOREIGN KEY ("workId") REFERENCES "LibraryWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LibraryEdition" (
 "id" TEXT NOT NULL, "workId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "editor" TEXT, "publisher" TEXT, "year" INTEGER, "language" TEXT,
 "url" TEXT, "citation" TEXT, "textStatus" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
 "rightsStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "expectedUnits" INTEGER,
 "availableUnits" INTEGER, CONSTRAINT "LibraryEdition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LibraryEdition_workId_idx" ON "LibraryEdition"("workId");
ALTER TABLE "LibraryEdition" ADD CONSTRAINT "LibraryEdition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "LibraryWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LibraryEvidence" (
 "id" TEXT NOT NULL, "workId" TEXT NOT NULL, "attributionId" TEXT,
 "editionId" TEXT, "sourceTitle" TEXT NOT NULL, "sourceUrl" TEXT,
 "reference" TEXT, "note" TEXT, "reviewed" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LibraryEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LibraryEvidence_workId_reviewed_idx" ON "LibraryEvidence"("workId","reviewed");
ALTER TABLE "LibraryEvidence" ADD CONSTRAINT "LibraryEvidence_workId_fkey" FOREIGN KEY ("workId") REFERENCES "LibraryWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryEvidence" ADD CONSTRAINT "LibraryEvidence_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "LibraryAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryEvidence" ADD CONSTRAINT "LibraryEvidence_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "LibraryEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LibraryReview" (
 "id" TEXT NOT NULL, "workId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "action" TEXT NOT NULL, "note" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LibraryReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LibraryReview_workId_createdAt_idx" ON "LibraryReview"("workId","createdAt");
ALTER TABLE "LibraryReview" ADD CONSTRAINT "LibraryReview_workId_fkey" FOREIGN KEY ("workId") REFERENCES "LibraryWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

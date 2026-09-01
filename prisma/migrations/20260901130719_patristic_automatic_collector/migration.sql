-- CreateEnum
CREATE TYPE "PatristicVerification" AS ENUM ('CANDIDATE', 'TEXT_VERIFIED', 'MULTI_SOURCE_VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "PatristicQuote" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorNameOriginal" TEXT,
    "workTitle" TEXT NOT NULL,
    "workTitleOriginal" TEXT,
    "originalLanguage" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "section" TEXT,
    "chapter" TEXT,
    "paragraph" TEXT,
    "pgReference" TEXT,
    "scReference" TEXT,
    "cpgReference" TEXT,
    "translationSr" TEXT,
    "translationEn" TEXT,
    "topics" TEXT[],
    "verification" "PatristicVerification" NOT NULL DEFAULT 'CANDIDATE',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatristicQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatristicQuoteSource" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceType" TEXT,
    "exactMatch" BOOLEAN NOT NULL DEFAULT false,
    "page" TEXT,
    "column" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatristicQuoteSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatristicQuote_fingerprint_key" ON "PatristicQuote"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PatristicQuoteSource_quoteId_url_key" ON "PatristicQuoteSource"("quoteId", "url");

-- AddForeignKey
ALTER TABLE "PatristicQuoteSource" ADD CONSTRAINT "PatristicQuoteSource_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PatristicQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

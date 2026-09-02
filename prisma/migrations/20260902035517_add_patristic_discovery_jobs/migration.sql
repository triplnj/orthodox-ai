-- CreateEnum
CREATE TYPE "PatristicDiscoveryJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PatristicDiscoveryJob" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "PatristicDiscoveryJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PatristicDiscoveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatristicDiscoveryJob_status_createdAt_idx" ON "PatristicDiscoveryJob"("status", "createdAt");

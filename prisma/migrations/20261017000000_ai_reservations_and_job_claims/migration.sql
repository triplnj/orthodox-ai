-- Additive only. Prepare locally; apply through the normal reviewed deployment.
ALTER TABLE "PatristicDiscoveryJob" ADD COLUMN "claimToken" TEXT;
ALTER TABLE "PatristicDiscoveryJob" ADD COLUMN "dispatchedAt" TIMESTAMP(3);

CREATE TABLE "AiReservation" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiReservation_subject_createdAt_idx" ON "AiReservation"("subject", "createdAt");
CREATE INDEX "AiReservation_subject_status_expiresAt_idx" ON "AiReservation"("subject", "status", "expiresAt");
CREATE INDEX "usage_logs_userId_feature_createdAt_idx" ON "usage_logs"("userId", "feature", "createdAt");

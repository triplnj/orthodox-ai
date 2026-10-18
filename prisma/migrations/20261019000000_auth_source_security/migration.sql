-- Prepared locally only. Do not execute without deployment authorization.
BEGIN;
CREATE TABLE "AuthRateLimitBucket" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthRateLimitBucket_expiresAt_idx" ON "AuthRateLimitBucket"("expiresAt");
CREATE TABLE "PatristicSourceDomain" (
  "hostname" TEXT NOT NULL PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "redirectHosts" TEXT[] NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "verifiedBy" TEXT NOT NULL,
  "verificationNote" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PatristicSourceDomainAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hostname" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "addresses" TEXT[] NOT NULL,
  "redirectHosts" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PatristicSourceDomainAudit_hostname_createdAt_idx" ON "PatristicSourceDomainAudit"("hostname", "createdAt");
COMMIT;

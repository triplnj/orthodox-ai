-- PREPARED ONLY: do not apply to production before an approved migration window.
-- Separate Paddle Live audit and entitlement tables. Legacy provider CHECK constraints
-- and user plan pointers remain untouched.
CREATE TABLE "PaddleLiveEvent" (
 "eventId" TEXT PRIMARY KEY,
 "eventType" TEXT NOT NULL,
 "subscriptionId" TEXT,
 "payloadDigest" CHAR(64) NOT NULL,
 "occurredAt" TIMESTAMP(3),
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "processedAt" TIMESTAMP(3),
 "status" TEXT NOT NULL DEFAULT 'RECEIVED'
   CHECK ("status" IN ('RECEIVED','VERIFIED','IGNORED','ERROR'))
);
CREATE INDEX "PaddleLiveEvent_subscriptionId_idx" ON "PaddleLiveEvent" ("subscriptionId", "receivedAt");

CREATE TABLE "PaddleLiveSubscription" (
 "subscriptionId" TEXT PRIMARY KEY,
 "customerId" TEXT NOT NULL,
 "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
 "productId" TEXT NOT NULL,
 "priceId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'unverified',
 "periodEndsAt" TIMESTAMP(3),
 "paidTransactionId" TEXT,
 "verifiedAt" TIMESTAMP(3),
 "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaddleLiveSubscription_valid_ids"
 CHECK ("subscriptionId" ~ '^sub_[a-z0-9]{26}$' AND "customerId" ~ '^ctm_[a-z0-9]{26}$')
);
CREATE INDEX "PaddleLiveSubscription_userId_idx"
 ON "PaddleLiveSubscription" ("userId", "periodEndsAt");
CREATE INDEX "PaddleLiveSubscription_customerId_idx"
 ON "PaddleLiveSubscription" ("customerId");
-- Customer-to-user collisions must be checked under a transaction lock;
-- a customer may have multiple legitimate subscription records.

-- Attempts are fenced across all concurrent Live checkouts for an account.
CREATE TABLE "PaddleLiveCheckoutAttempt" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN'
    CHECK ("status" IN ('OPEN','PAID','RECONCILED','EXPIRED','UNKNOWN')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidTransactionId" TEXT,
  "subscriptionId" TEXT
);
CREATE UNIQUE INDEX "PaddleLiveCheckoutAttempt_one_pending_per_user"
  ON "PaddleLiveCheckoutAttempt" ("userId")
  WHERE "userId" IS NOT NULL AND "status" IN ('OPEN','UNKNOWN');
CREATE UNIQUE INDEX "PaddleLiveCheckoutAttempt_paid_transaction_unique"
  ON "PaddleLiveCheckoutAttempt" ("paidTransactionId")
  WHERE "paidTransactionId" IS NOT NULL;

-- PROPOSAL ONLY. NOT EXECUTED. Deliberately outside prisma/migrations.
-- Requires approval of docs/phase-3-billing-proposal.md before implementation.
-- Preserve existing user fields; do not infer ownership/status of dual-provider
-- legacy accounts from the single shared subscriptionStatus column.

ALTER TABLE "users" ADD COLUMN "billingDeletionRequestedAt" TIMESTAMP(3);

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('STRIPE', 'LEMONSQUEEZY')),
  "providerSubscriptionId" TEXT NOT NULL,
  "providerCustomerId" TEXT,
  "providerProductId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unverified_legacy',
  "legacySnapshotStatus" TEXT,
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "providerUpdatedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillingSubscription_provider_subscription_key" ON "BillingSubscription"("provider", "providerSubscriptionId");
CREATE INDEX "BillingSubscription_userId_idx" ON "BillingSubscription"("userId");

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('STRIPE', 'LEMONSQUEEZY')),
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerSubscriptionId" TEXT,
  "payloadDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingWebhookEvent_provider_event_key" ON "BillingWebhookEvent"("provider", "eventId");

CREATE TABLE "BillingCheckoutAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('STRIPE', 'LEMONSQUEEZY')),
  "status" TEXT NOT NULL DEFAULT 'CREATING',
  "providerCheckoutId" TEXT,
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingCheckoutAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingCheckoutAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BillingCheckoutAttempt_userId_idx" ON "BillingCheckoutAttempt"("userId");
-- Cross-provider uniqueness: ambiguous creation results stay fenced.
CREATE UNIQUE INDEX "BillingCheckoutAttempt_one_pending_per_user"
  ON "BillingCheckoutAttempt"("userId")
  WHERE "userId" IS NOT NULL AND "status" IN ('CREATING', 'OPEN', 'UNKNOWN');

-- Copy references without updating or deleting existing users or provider IDs.
-- Prefixing by user ID allows the unique provider/subscription index to expose
-- ambiguous pre-existing mappings instead of silently assigning the wrong owner.
-- Inspect conflicts on staging and resolve them under a reviewed process before
-- rollout; do not use ON CONFLICT to discard customer history or guess ownership.
INSERT INTO "BillingSubscription" ("id", "userId", "provider", "providerSubscriptionId", "providerCustomerId", "legacySnapshotStatus")
SELECT 'legacy-stripe:' || "id", "id", 'STRIPE', "subscriptionId", "stripeCustomerId", "subscriptionStatus"
FROM "users" WHERE "subscriptionId" IS NOT NULL;

INSERT INTO "BillingSubscription" ("id", "userId", "provider", "providerSubscriptionId", "providerCustomerId", "legacySnapshotStatus")
SELECT 'legacy-lemon:' || "id", "id", 'LEMONSQUEEZY', "lemonSqueezySubscriptionId", "lemonSqueezyCustomerId", "subscriptionStatus"
FROM "users" WHERE "lemonSqueezySubscriptionId" IS NOT NULL;

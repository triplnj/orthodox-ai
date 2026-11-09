-- NOT AUTHORIZED FOR EXECUTION WITHOUT USER APPROVAL.
-- EXECUTE ONLY via the Neon connector with EXACT branch_id:
-- br-empty-breeze-asd2dqrq (orthodoxai-chat-isolated-preview-2026-11-09)
-- NEVER run on production or patristic-library-staging parent.
-- A failure must ROLLBACK the whole operation.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM "LibraryStagingGuard" WHERE
     "branchId"='br-spring-frost-assfzje6'
     AND "purpose"='PATRISTIC_LIBRARY_STAGING') <> 1
 OR (SELECT count(*) FROM "LibraryPassage") <> 297
 THEN RAISE EXCEPTION 'Aborting: unexpected cloned preview source'; END IF;
END
$guard$;
-- User-related rows and their FK dependents are removed from THIS NEW CLONE ONLY.
TRUNCATE TABLE "users", "AuthRateLimitBucket", "BillingWebhookEvent",
 "BlogPost", "PatristicDiscoveryJob", "PatristicSourceDomainAudit"
 RESTART IDENTITY CASCADE;
-- Mark the clone for its *distinct* purpose, not as the original staging branch.
UPDATE "LibraryStagingGuard"
 SET "branchId"='br-empty-breeze-asd2dqrq',
     "purpose"='PATRISTIC_CHAT_ISOLATED_PREVIEW'
 WHERE "branchId"='br-spring-frost-assfzje6'
 AND "purpose"='PATRISTIC_LIBRARY_STAGING';
DO $check$
BEGIN
 IF (SELECT count(*) FROM "LibraryStagingGuard" WHERE
  "branchId"='br-empty-breeze-asd2dqrq'
  AND "purpose"='PATRISTIC_CHAT_ISOLATED_PREVIEW') <> 1
 OR (SELECT count(*) FROM "users") <> 0
 OR (SELECT count(*) FROM "sessions") <> 0
 OR (SELECT count(*) FROM "Conversation") <> 0
 OR (SELECT count(*) FROM "chat_messages") <> 0
 OR (SELECT count(*) FROM "LibraryPassage") <> 297
 THEN RAISE EXCEPTION 'Aborting: QA privacy or source integrity preflight failed'; END IF;
END
$check$;
COMMIT;

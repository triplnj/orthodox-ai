BEGIN;
ALTER TABLE "AiReservation"
 ADD COLUMN "userId" TEXT,
 ADD COLUMN "requestKey" VARCHAR(128),
 ADD COLUMN "requestHash" CHAR(64),
 ADD COLUMN "responseSnapshot" JSONB;
CREATE UNIQUE INDEX "AiReservation_subject_feature_requestKey_key" ON "AiReservation" ("subject", "feature", "requestKey");
CREATE INDEX "AiReservation_userId_idx" ON "AiReservation" ("userId");
CREATE INDEX "AiReservation_status_finishedAt_idx" ON "AiReservation" ("status", "finishedAt");
ALTER TABLE "AiReservation" ADD CONSTRAINT "AiReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReservation" ADD CONSTRAINT "AiReservation_request_identity_check" CHECK (
 ("requestKey" IS NULL AND "requestHash" IS NULL AND "responseSnapshot" IS NULL) OR
 ("requestKey" IS NOT NULL AND "requestHash" IS NOT NULL AND "userId" IS NOT NULL AND "subject" = "userId"
 AND "feature" IN ('prayer-plan','fasting-plan','scripture-plan','journal-summary')
 AND "requestKey" ~ '^[A-Za-z0-9_-]{1,128}$' AND "requestHash" ~ '^[0-9a-f]{64}$'));
ALTER TABLE "AiReservation" ADD CONSTRAINT "AiReservation_cached_result_check" CHECK (
 "requestKey" IS NULL OR (
 "status" IN ('RUNNING','COMPLETED','FAILED','ABANDONED','RESULT_EXPIRED')
 AND (("status" = 'RUNNING' AND "finishedAt" IS NULL) OR ("status" <> 'RUNNING' AND "finishedAt" IS NOT NULL)) AND (
 ("status" = 'COMPLETED' AND "finishedAt" IS NOT NULL AND "responseSnapshot" IS NOT NULL
 AND jsonb_typeof("responseSnapshot") = 'object' AND octet_length("responseSnapshot"::text) <= 262144) OR
 ("status" <> 'COMPLETED' AND "responseSnapshot" IS NULL))));

CREATE FUNCTION protect_keyed_ai_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."requestKey" IS NOT NULL THEN
  IF OLD."status" = 'RUNNING' AND NEW."status" = 'RESULT_EXPIRED' THEN
   RAISE EXCEPTION 'Only completed results can expire';
  END IF;
  IF ROW(NEW."id",NEW."subject",NEW."feature",NEW."userId",NEW."requestKey",NEW."requestHash",NEW."createdAt")
   IS DISTINCT FROM ROW(OLD."id",OLD."subject",OLD."feature",OLD."userId",OLD."requestKey",OLD."requestHash",OLD."createdAt") THEN
   RAISE EXCEPTION 'AI request identity is immutable';
  END IF;
  -- Retention can only erase a completed private cache after seven days. It
  -- preserves the charged row, original finish time, key and fingerprint.
  IF OLD."status" = 'ABANDONED' AND NEW."status" = 'ABANDONED'
   AND (to_jsonb(NEW) - 'expiresAt') = (to_jsonb(OLD) - 'expiresAt') THEN RETURN NEW; END IF;
  IF OLD."status" = 'COMPLETED' AND NEW."status" = 'RESULT_EXPIRED'
   AND NEW."responseSnapshot" IS NULL
   AND OLD."finishedAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '7 days'
   AND NEW."finishedAt" IS NOT DISTINCT FROM OLD."finishedAt"
   AND NEW."expiresAt" IS NOT DISTINCT FROM OLD."expiresAt" THEN RETURN NEW; END IF;
  IF OLD."status" IN ('COMPLETED','FAILED','ABANDONED','RESULT_EXPIRED') AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Terminal AI reservations are immutable';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "AiReservation_keyed_identity_immutable" BEFORE UPDATE ON "AiReservation" FOR EACH ROW EXECUTE FUNCTION protect_keyed_ai_reservation();
COMMIT;

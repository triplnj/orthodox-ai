-- PREPARED ONLY. Execution requires separate authorization, paused sensitive
-- writes and drained old workers, immediately before the application cutover.
BEGIN;

SET LOCAL TIME ZONE 'UTC';

ALTER TABLE "users"
ADD COLUMN "legacyReconciliationDeadlineAt" TIMESTAMP(3);

DO $migration$
DECLARE
  cutover_utc TIMESTAMP(3);
  deadline_utc TIMESTAMP(3);
  candidate_count BIGINT;
BEGIN
  cutover_utc :=
    (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  deadline_utc := cutover_utc + INTERVAL '72 hours';

  -- Candidates only: these fields cannot prove payment or ownership. Runtime
  -- validation must reject conflicts, known terminal state and invalid evidence.
  -- Neither PRO state nor provider verification evidence is changed here.
  UPDATE "users"
  SET "legacyReconciliationDeadlineAt" = deadline_utc
  WHERE "plan" = 'PRO'
    AND "subscriptionStatus" = 'active'
    AND "billingAccessUntil" IS NULL;

  GET DIAGNOSTICS candidate_count = ROW_COUNT;
  RAISE NOTICE
    'Legacy reconciliation cutover UTC: %, deadline UTC: %, candidates: %',
    cutover_utc, deadline_utc, candidate_count;
END;
$migration$;

CREATE FUNCTION "enforce_legacy_reconciliation_deadline"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."legacyReconciliationDeadlineAt" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'New users cannot receive a legacy reconciliation deadline.';
    END IF;
  ELSE
    IF NEW."legacyReconciliationDeadlineAt"
       IS DISTINCT FROM OLD."legacyReconciliationDeadlineAt" THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'The legacy reconciliation deadline is immutable.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "users_legacy_reconciliation_deadline_immutable"
BEFORE INSERT OR UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "enforce_legacy_reconciliation_deadline"();

COMMIT;

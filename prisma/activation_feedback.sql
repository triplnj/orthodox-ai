-- Apply once to production Neon database before enabling feedback endpoint.
CREATE TABLE IF NOT EXISTS "UserActivationFeedback" (
  "userId" text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('not_using','price','unclear_value','answer_quality','other')),
  feature text NOT NULL CHECK (feature IN ('patristics','chat','journal','confession','prayer','other')),
  suggestion text,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

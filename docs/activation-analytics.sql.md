# OrthodoxAI activation analysis (read-only)

Run these queries against Neon PostgreSQL using **read-only access**. They do not modify users, conversations, subscriptions or message content.

## Exclude administrator and test accounts

Replace `REPLACE_WITH_ADMIN_USER_ID` with each **verified account ID** configured in `BLOG_ADMIN_USER_IDS`; add any known test IDs. Never exclude by email or by PRO plan alone. If no IDs are configured, resolve them before presenting these metrics as non-admin figures.

```sql
WITH excluded_users AS (
  SELECT unnest(ARRAY['REPLACE_WITH_ADMIN_USER_ID']::text[]) AS id
),
public_users AS (
  SELECT u.id, u."createdAt", u."emailVerified"
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM excluded_users e WHERE e.id = u.id)
),
chat_activity AS (
  SELECT m."userId", COUNT(*) AS questions,
         COUNT(DISTINCT m."createdAt"::date) AS active_days,
         MAX(m."createdAt") AS last_question_at
  FROM chat_messages m
  JOIN public_users u ON u.id = m."userId"
  WHERE m.role = 'user'
  GROUP BY m."userId"
)
SELECT (SELECT COUNT(*) FROM public_users) AS registered_users,
       (SELECT COUNT(*) FROM public_users WHERE "emailVerified" IS NOT NULL) AS verified_users,
       (SELECT COUNT(*) FROM public_users WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS registered_last_30d,
       COUNT(*) FILTER (WHERE questions > 0) AS tried_chat,
       COALESCE(SUM(questions),0) AS total_questions,
       COUNT(*) FILTER (WHERE active_days >= 2) AS returned_to_chat,
       COUNT(*) FILTER (WHERE last_question_at >= NOW() - INTERVAL '7 days') AS chat_active_last_7d,
       COUNT(*) FILTER (WHERE last_question_at >= NOW() - INTERVAL '30 days') AS chat_active_last_30d
FROM chat_activity;
```

## Daily question counts (proxy, not quota-denial events)

This query estimates days with at least three user messages. It does **not** prove that the daily quota was reached or an upgrade prompt was shown.

```sql
WITH excluded_users AS (
  SELECT unnest(ARRAY['REPLACE_WITH_ADMIN_USER_ID']::text[]) AS id
),
daily_messages AS (
  SELECT m."userId", m."createdAt"::date AS activity_date, COUNT(*) AS questions
  FROM chat_messages m
  WHERE m.role = 'user'
    AND NOT EXISTS (SELECT 1 FROM excluded_users e WHERE e.id = m."userId")
  GROUP BY m."userId", m."createdAt"::date
)
SELECT COUNT(DISTINCT "userId") FILTER (WHERE questions >= 3) AS users_with_3plus_per_day,
       COUNT(*) FILTER (WHERE questions >= 3) AS user_days_3plus,
       COUNT(DISTINCT "userId") FILTER (WHERE questions >= 5) AS users_with_5plus_per_day
FROM daily_messages;
```

## Data gaps

- No account-login timestamp is stored in the current users table; chat activity is not equivalent to sign-in activity.
- `usage_logs` records features, not explicit paywall impressions, pricing visits or marketing consent.
- The `BillingSubscription` table may differ from legacy `users.subscriptionStatus` values; reconcile before reporting paid conversions.
- Do not inspect private question text, journal content, or individual emails for marketing analytics.
- Introduce consent-based feedback collection and pseudonymous activation events in a later, separately reviewed migration.

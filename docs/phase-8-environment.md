# Phase 8 environment and retention inventory

This inventory describes local source requirements, not verified production settings. No actual secrets or production configuration were read. Build-time credentials are not required; runtime credentials remain necessary for their respective features. Never prefix secrets with NEXT_PUBLIC.

Billing/privacy correction: see `phase-8-billing-privacy.md` for the immutable 72-hour deployment-cutover marker and migration prerequisites. No environment variable starts or renews that window. `DEBUG` and `NODE_DEBUG` must be unset in production; OpenAI SDK logging is forced off regardless of `OPENAI_LOG`. Configure seven-day retention and disable private request/response capture in external hosting logs, drains and error reporting separately. No external configuration was changed locally.

| Variable | Purpose and requirement |
| --- | --- |
| NODE_ENV | Deployment runtime mode; production in deployment. |
| DATABASE_URL | Secret runtime PostgreSQL connection; transaction/advisory-lock semantics must work through any pooler. |
| DIRECT_URL | Secret direct migration connection; prefer separate DDL credentials, unavailable to ordinary runtime where practical. |
| OPENAI_API_KEY | Secret runtime AI credential; lazy initialization permits credential-free builds. |
| OPENAI_ADMIN_KEY | Secret optional administrative AI capability; configure only where needed. |
| PATRISTICS_MODEL | Research model configuration required by relevant research helpers; retain approved existing selection. |
| PATRISTICS_SECRET | Secret authorized worker credential; not ordinary user access. |
| PATRISTICS_ADMIN_USER_IDS | Explicit authorized research administrators; verify account ownership. |
| PATRISTICS_SOURCE_ADMIN_USER_IDS | Explicit authorized source-domain administrators; additions still require HTTPS/DNS validation and auditing. |
| ENABLE_PATRISTICS_TEST_ROUTES | Keep unset/false in production; enabling does not replace authorization. |
| BLOG_ADMIN_USER_IDS | Explicit verified blog administrator identities. |
| BILLING_ADMIN_USER_IDS | Explicit billing recovery/reconciliation administrators. |
| LEMONSQUEEZY_API_KEY | Secret current-provider API credential. |
| LEMONSQUEEZY_STORE_ID | Current-provider store identifier; verify correct environment. |
| LEMONSQUEEZY_PRO_VARIANT_ID | Existing approved PRO product variant; preserve pricing/entitlements. |
| LEMONSQUEEZY_WEBHOOK_SECRET | Secret signature-verification key. |
| STRIPE_PRO_PRICE_ID | Legacy-compatible Stripe price identifier; preserve existing subscribers. |
| STRIPE_WEBHOOK_SECRET | Secret Stripe signature-verification key. |
| STRIPE_SECRET_KEY | Secret lazy runtime Stripe credential; required for active legacy Stripe billing operations. |
| NEXT_PUBLIC_APP_URL | Public canonical HTTPS application origin; redirects/email links must use the intended origin. |
| RESEND_API_KEY | Secret email delivery credential. |
| EMAIL_FROM | Authorized verified sending identity. |
| AUTH_RATE_LIMIT_SECRET | Secret stable hash key, at least 32 characters; missing/invalid configuration fails safely. |
| AUTH_TRUSTED_IP_HEADER | Trusted single-IP header overwritten by the ingress proxy; never trust client-supplied values. Without reliable IP, shared unknown-ingress limiting can affect unrelated users. |
| AI_QUOTA_TIMEZONE | Explicit stable server-side daily-accounting timezone. Determine existing production semantics before setting; do not change midnight/reset behavior accidentally. |
| AI_CACHE_CLEANUP_SECRET | Secret Bearer authorization for POST `/api/internal/ai-cache-cleanup`; configure an authenticated scheduler. |
| REVIEW_ACCESS_TOKEN | Optional secret review-link access; disable until the preclaim blocker is resolved. |
| REVIEW_USER_EMAIL | Optional Fr Josiah review identity; an email string alone is unsafe provisioning. |
| REVIEW_CLERGY_ACCESS_TOKEN | Optional secret clergy review-link access; same restriction. |
| REVIEW_CLERGY_USER_EMAIL | Optional clergy review identity; same restriction. |
| REVIEW_USER_ID | Explicit server-side Fr Josiah identity binding; required for its provisioning route. Existing-account binding requires approved provenance review and legacy session/token transition. |
| REVIEW_CLERGY_USER_ID | Explicit server-side clergy identity binding; same restrictions. Must differ from REVIEW_USER_ID. |
| CHAT_HISTORY_MAX_TURNS | Default 6, strict maximum 20. |
| CHAT_HISTORY_MAX_TOKENS | Default 4,000, strict maximum 12,000. |
| CHAT_QUESTION_MAX_TOKENS | Default 2,000, range 1–4,000. |
| CHAT_INPUT_MAX_TOKENS | Default 16,000, range 4,000–32,000. |
| CHAT_OUTPUT_MAX_TOKENS | Default 2,048, range 128–4,096. |

These are the 37 application/configuration variables identified after review-identity remediation, including the lazy Stripe initializer. See `phase-8-review-security.md` for mandatory operator transition and link-enable order. Chat bounds fall back/clamp according to server configuration; they do not change daily quota values. Do not assume their maxima represent an appropriate spend budget for every deployment.

## Stripe credential note

Preserve legacy Stripe support even while Lemon Squeezy remains the current payment provider. The lazy initializer reads STRIPE_SECRET_KEY only when Stripe is used and reports a controlled configuration error when absent. Never provide a dummy value to pass a build.

## SDK and platform configuration

The installed OpenAI SDK can additionally read OPENAI_ORG_ID, OPENAI_PROJECT_ID, OPENAI_BASE_URL, OPENAI_LOG and OPENAI_CUSTOM_HEADERS. Preserve intended organization/project routing; do not enable verbose sensitive logging or untrusted endpoint overrides. OPENAI_WEBHOOK_SECRET belongs to an unused SDK feature, not an established application requirement.

Hosted workflow dependencies may consume VERCEL, VERCEL_DEPLOYMENT_ID, VERCEL_PROJECT_ID, VERCEL_DEPLOYMENT_KEY, VERCEL_TOKEN and VERCEL_WORKFLOW_SERVER_URL, plus backend/stream/queue tuning flags. Platform-provided identity must not be replaced with copied production credentials. Actual hosted queue, identity, persistence and restart recovery were not verified locally.

Development workflow controls include WORKFLOW_LOCAL_DATA_DIR, WORKFLOW_LOCAL_BASE_URL, WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS, WORKFLOW_LOCAL_QUEUE_MAX_VISIBILITY, WORKFLOW_LOCAL_QUEUE_CONCURRENCY, WORKFLOW_MAX_EVENTS and PORT. Local filesystem workflow state is not proof of durable production storage. This appendix lists relevant implicit dependencies, not a requirement to set every SDK variable.

## Timezone and retention deployment requirements

* Pin AI_QUOTA_TIMEZONE only after reviewing current authoritative accounting and historical timestamp storage. PostgreSQL TIMESTAMP(3) defaults also depend on the database session timezone; configuring the application variable alone does not settle historical conversion semantics. Validate database/role session timezone, midnight and DST boundaries before rollout.
* Cached private AI responses, including summaries, expire after **seven days**. Clean only cached payloads; preserve reservation identity, charging facts and fencing metadata so expired payloads cannot authorize a duplicate AI attempt. Access-time expiry does not substitute for scheduled physical erasure. Configure authenticated hourly POST cleanup; no working scheduler was verified in this repository.
* Account deletion must remove keyed private caches and conversation data while preserving minimum detached billing evidence for the documented **90-day** window. Retain provider identifiers/status/timestamps and necessary audit reasons for cancellation confirmation, replay protection and reconciliation; do not retain full private response content or card data. Before purging, verify no unsettled billing, dispute or recovery requirement remains. Assign an operator and an audited purge procedure.
* Expired authentication-limit buckets and unkeyed reservation metadata need a bounded operational cleanup/anonymization policy. Do not delete identity/accounting records in a way that reopens idempotency or quotas.
* Billing recovery must reconcile authoritative provider state, record an audit trail and preserve uncertain-operation fences. A timeout alone never proves cancellation, absence of a subscription or safe checkout retry.

No environment values were changed and no cleanup scheduler, migration or production configuration was applied in Phase 8.

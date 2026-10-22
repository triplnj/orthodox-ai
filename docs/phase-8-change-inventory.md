# Phase 8 local change inventory

Comparison base: 41e4baf (before Phases 1-4). HEAD: c7fa8b0. Branch: audit/orthodoxai-hardening.

Complete net tracked changes against the comparison base, plus all untracked files. Includes earlier phase work, the authorized billing BOM correction, Phase 8 audit artifacts and the authorized review-identity remediation. See phase-8-review-security.md for the exact 14-file remediation manifest.

Tracked net changed paths: 169. Untracked files: 46.

## Tracked comparison

```text
A	docs/blog-security-phase-1.md
A	docs/phase-2-security.md
A	docs/phase-3-billing-proposal.md
A	docs/phase-3-billing-security.md
A	docs/phase-4-security.md
M	middleware.ts
M	package-lock.json
M	package.json
A	prisma/migrations/20261017000000_ai_reservations_and_job_claims/migration.sql
A	prisma/migrations/20261018000000_billing_integrity/migration.sql
A	prisma/migrations/20261019000000_auth_source_security/migration.sql
A	prisma/proposed-migrations/phase-3-billing-integrity.sql
M	prisma/schema.prisma
M	src/app/account/page.tsx
M	src/app/admin/blog/[id]/edit/page.tsx
A	src/app/admin/blog/actions.ts
M	src/app/admin/blog/new/page.tsx
M	src/app/api/account/delete/route.ts
M	src/app/api/account/route.ts
A	src/app/api/admin/patristic-source-domains/route.ts
M	src/app/api/admin/patristics/backfill-translations/route.ts
M	src/app/api/admin/patristics/collect/route.ts
M	src/app/api/admin/patristics/discover/route.ts
M	src/app/api/admin/patristics/embed/route.ts
A	src/app/api/admin/patristics/jobs/route.ts
M	src/app/api/admin/patristics/repair/route.ts
M	src/app/api/admin/patristics/verify/route.ts
A	src/app/api/auth/clear-invalid-session/route.ts
M	src/app/api/auth/forgot-password/route.ts
M	src/app/api/auth/login/route.ts
M	src/app/api/auth/logout/route.ts
M	src/app/api/auth/register/route.ts
M	src/app/api/auth/resend-verification/route.ts
M	src/app/api/auth/reset-password/route.ts
M	src/app/api/auth/verify-email/route.ts
A	src/app/api/billing/recover/route.ts
M	src/app/api/chat/route.ts
M	src/app/api/dashboard/route.ts
M	src/app/api/history/route.ts
M	src/app/api/journal/route.ts
M	src/app/api/journal/summarize/route.ts
M	src/app/api/lemonsqueezy/create-checkout/route.ts
M	src/app/api/lemonsqueezy/customer-portal/route.ts
M	src/app/api/lemonsqueezy/webhook/route.ts
M	src/app/api/onboarding/route.ts
M	src/app/api/patristics/discover-background/route.ts
M	src/app/api/patristics/enqueue-test/route.ts
M	src/app/api/patristics/pg-clean-test/route.ts
M	src/app/api/patristics/pg-general-test/route.ts
M	src/app/api/patristics/pg-search-test/route.ts
M	src/app/api/patristics/pg-translate-test/route.ts
M	src/app/api/patristics/pg-verify-clean-test/route.ts
M	src/app/api/patristics/pg-witness-test/route.ts
M	src/app/api/patristics/process-job-test/route.ts
M	src/app/api/patristics/start-workflow-test/route.ts
M	src/app/api/pro/fasting-plan/route.ts
M	src/app/api/pro/prayer-plan/route.ts
M	src/app/api/pro/scripture-plan/route.ts
M	src/app/api/review/chat/route.ts
M	src/app/api/review/clergy/start/route.ts
M	src/app/api/review/fr-josiah/start/route.ts
M	src/app/api/settings/delete/route.ts
M	src/app/api/settings/export/route.ts
M	src/app/api/settings/password/route.ts
M	src/app/api/settings/profile/route.ts
M	src/app/api/stripe/create-checkout-session/route.ts
M	src/app/api/stripe/customer-portal/route.ts
M	src/app/api/stripe/webhook/route.ts
M	src/app/blog/[slug]/page.tsx
M	src/app/confession/page.tsx
M	src/app/dashboard/page.tsx
M	src/app/fasting/page.tsx
M	src/app/forgot-password/page.tsx
M	src/app/globals.css
M	src/app/history/page.tsx
M	src/app/journal/page.tsx
M	src/app/layout.tsx
M	src/app/login/page.tsx
M	src/app/onboarding/page.tsx
M	src/app/page.tsx
M	src/app/prayers/page.tsx
M	src/app/pricing/page.tsx
M	src/app/pro/page.tsx
M	src/app/pro/success/page.tsx
M	src/app/register/page.tsx
M	src/app/reset-password/page.tsx
M	src/app/review/clergy/page.tsx
M	src/app/review/fr-josiah/page.tsx
M	src/app/scripture/page.tsx
M	src/app/settings/page.tsx
M	src/app/today/page.tsx
M	src/app/verify-email/page.tsx
A	src/components/auth/LoginForm.tsx
A	src/components/auth/RegisterForm.tsx
M	src/components/billing/CheckoutButton.tsx
M	src/components/billing/CustomerPortalButton.tsx
M	src/components/blog/BlogContentEditor.tsx
M	src/components/chat/ChatBox.tsx
M	src/components/layout/Footer.tsx
M	src/components/layout/LogoutButton.tsx
M	src/components/layout/NavbarClient.tsx
M	src/components/pro/FastingPlanForm.tsx
M	src/components/pro/PrayerPlanForm.tsx
M	src/components/pro/ProStatusCard.tsx
M	src/components/pro/ScripturePlanForm.tsx
M	src/lib/ai/chatService.ts
A	src/lib/ai/openaiClient.ts
A	src/lib/ai/operationLimits.ts
A	src/lib/ai/requestSecurity.ts
A	src/lib/ai/secureRoute.ts
M	src/lib/auth.ts
A	src/lib/billing/http.ts
A	src/lib/billing/providers.ts
A	src/lib/billing/service.ts
M	src/lib/blogAdmin.ts
A	src/lib/blogContent.ts
M	src/lib/email.ts
A	src/lib/patristics/api-security.ts
M	src/lib/patristics/backfill-translations.ts
M	src/lib/patristics/build-chat-context.ts
M	src/lib/patristics/build-greek-search-terms.ts
M	src/lib/patristics/build-patristic-research-context.ts
M	src/lib/patristics/build-text-search-terms.ts
M	src/lib/patristics/clean-pg-ocr.ts
A	src/lib/patristics/dispatch-job.ts
M	src/lib/patristics/embeddings.ts
M	src/lib/patristics/enqueue-discovery.ts
M	src/lib/patristics/extract-quotes.ts
M	src/lib/patristics/fetch-source.ts
M	src/lib/patristics/greek-witness.ts
A	src/lib/patristics/job-claims.ts
M	src/lib/patristics/pg-passage-search.ts
M	src/lib/patristics/pg-volume-source.ts
M	src/lib/patristics/pg-work-range.ts
M	src/lib/patristics/process-discovery-job.ts
M	src/lib/patristics/resolve-pg-author.ts
M	src/lib/patristics/resolve-pg-catalog-volumes.ts
M	src/lib/patristics/search-wikisource-collection.ts
M	src/lib/patristics/translate-pg-passages.ts
M	src/lib/patristics/verify-attribution.ts
M	src/lib/patristics/verify-cleaned-pg.ts
M	src/lib/patristics/verify-second-source.ts
M	src/lib/patristics/web-patristic-research.ts
M	src/lib/productCopy.ts
A	src/lib/security/auth-http.ts
A	src/lib/security/auth-input.ts
A	src/lib/security/auth-limits.ts
A	src/lib/security/auth-page.ts
A	src/lib/security/auth-service.ts
A	src/lib/security/public-dns.ts
A	src/lib/security/redirect.ts
A	src/lib/security/source-admin.ts
A	src/lib/security/source-policy.ts
A	src/lib/security/source-transport.ts
M	src/lib/session.ts
M	src/lib/stripe.ts
M	src/lib/subscription.ts
M	src/lib/usage.ts
M	src/workflows/patristic-discovery.ts
A	tests/blog-security.test.mjs
A	tests/helpers/auth-harness.mjs
A	tests/helpers/load-ts.mjs
A	tests/openai-initialization.test.mjs
A	tests/phase2-security.test.mjs
A	tests/phase3-billing.test.mjs
A	tests/phase4-auth.test.mjs
A	tests/phase4-ssrf.test.mjs
A	tests/run-regressions.mjs
A	tests/stripe-initialization.test.mjs
```

## Untracked files

```text
docs/phase-5-conversations.md
docs/phase-6-api-quota-security.md
docs/phase-7-ui-accessibility.md
docs/phase-8-change-inventory.md
docs/phase-8-environment.md
docs/phase-8-readiness.md
docs/phase-8-review-security.md
prisma/migrations/20261019000000_conversation_memory_provenance/migration.sql
prisma/migrations/20261020000000_api_quota_integrity/migration.sql
src/app/api/ai/requests/recover/route.ts
src/app/api/ai/requests/route.ts
src/app/api/ai/usage/route.ts
src/app/api/conversations/[id]/recover/route.ts
src/app/api/conversations/[id]/route.ts
src/app/api/conversations/route.ts
src/app/api/internal/ai-cache-cleanup/route.ts
src/app/error.tsx
src/app/global-error.tsx
src/app/loading.tsx
src/app/not-found.tsx
src/components/chat/SourceCards.tsx
src/components/layout/ReadError.tsx
src/components/pro/usePersonalOperation.tsx
src/lib/ai/personalRequests.ts
src/lib/ai/quotaClock.ts
src/lib/api/blogInput.ts
src/lib/api/clientErrors.ts
src/lib/api/researchInput.ts
src/lib/api/response.ts
src/lib/api/validation.ts
src/lib/chat/context.ts
src/lib/chat/conversations.ts
src/lib/chat/history.ts
src/lib/chat/provenance.ts
src/lib/security/review-identities.ts
src/lib/security/review-provisioning.ts
tests/helpers/chat-models.mjs
tests/helpers/phase6-harness.mjs
tests/phase5-conversations.test.mjs
tests/phase6-api.test.mjs
tests/phase6-frontend.test.mjs
tests/phase6-postgres.test.mjs
tests/phase6-retries.test.mjs
tests/phase7-ui.test.mjs
tests/phase8-postgres.test.mjs
tests/phase8-review-security.test.mjs
```

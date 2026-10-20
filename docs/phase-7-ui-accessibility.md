# Phase 7: UI, accessibility and safe recovery

Implemented locally on 19 October 2026 after approval of the read-only audit and proposal.

## Scope and preserved behavior

No database schema, migration, billing service, authentication policy, quota value, AI model, prompt, or patristic grounding change was made in Phase 7. No dependency was added. The existing uncommitted changes from previous phases remain in the working tree; the manifest below identifies only files edited in this phase, including overlapping files. No production services, customer records or live AI/payment/email APIs were accessed. No migrations, commits, pushes or deployments were performed.

## Implemented changes

- Navigation: retain the existing primary and personal/account destination groups on desktop and mobile. Add named landmarks, current-page markers, a hamburger disclosure with expanded/controlled states, Escape handling, focus return, native keyboard navigation and an always-present hidden panel. Desktop groups wrap rather than overflowing. Footer links have larger targets.
- Shared presentation: retain the existing OrthodoxAI branding, content sections, light cards and explicitly dark sections. Correct invalid text-white-950 utilities, add a skip link, visible focus outlines, 44px control heights, wrapping, and reduced-motion rules. Remove the partial OS-dark-mode override that applied dark body colors without adapting the light page components; the existing explicit dark sections remain.
- Forms: programmatically associate labels in recovery, settings, onboarding, journal, personal-plan and blog-admin forms; retain the working existing login/registration flows. Use an onboarding fieldset/legend, announced error/success feedback, error descriptions and relevant client limits matching existing server bounds. Give the rich-text editor a visible accessible name, help text, invalid state and a named formatting group. Keep its sanitization and formatting behavior.
- Chat: preserve drafts per conversation in component memory, restore the submitted question after a failed/ambiguous request, retain the same request ID for an explicit retry, and prevent rapid duplicate Send calls. Serialize explicit saved-status reads, ignore stale/aborted reads, and guard new-conversation actions during a request. Distinguish saved-conversation loading from generation; provide empty guidance, speaker labels and concise status announcements instead of announcing the whole transcript. Wrap long content and controls on narrow layouts. Scroll to new content only near the bottom, with an explicit Jump to latest message control when reading older messages. Conversation labels include the existing updated date when supplied; no new title storage is introduced.
- Sources/history: show immutable answer-associated source snapshots as semantic lists, readable known provider labels, exact safe links, verification metadata and new-tab notices. Keep primary/OCR/curated/web distinctions and the verification caveat. Never infer or manufacture provenance. History does not claim an empty result or promote an upgrade before a successful access/history load.
- Read recovery: distinguish expired-session responses from network/read failures in account, dashboard, settings, history and journal. Offer explicit read-only reload actions; never automatically replay a sensitive write. Keep profile drafts when account data is reloaded, journal drafts on failed saves and existing plans on failed regeneration. Rapid authentication, profile/password/deletion, checkout/portal, logout and review-chat calls have client pending guards where changed. Existing server protections remain authoritative.
- Billing presentation only: replace misleading unlimited Pro copy with the existing FULL_ACCESS_DAILY_CHAT_LIMIT configuration (currently 100 chat questions/day). Preserve $7.99/month and $69/year and all entitlements. The checkout return page is dynamic and reads existing server-verified account access; it never declares that payment succeeded from a return URL. An active Pro entitlement is described only as active access, not proof of a particular payment. Pending/anonymous/inactive accounts are directed to check account state without starting another checkout. Settings deletion guidance is provider-neutral. Checkout uncertainty and logout failures have visible announced feedback.
- Recovery boundaries: add application loading, not-found, page-error and root-error views with safe messages and explicit recovery actions. No exception, stack, SQL or credential detail is rendered.

## Exact verification results

All suites use process isolation, one worker, a 30-second per-test timeout and a 60-second per-suite deadline. Live fetch is forbidden or mocked; previous database tests use mocks or in-memory PGlite, not production data. The runner removes provider/database credentials.

| Suite | Passed | Failed | Skipped | Cancelled | Exit |
|---|---:|---:|---:|---:|---:|
| blog-security | 33 | 0 | 0 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 | 0 | 0 |
| phase2-security | 45 | 0 | 0 | 0 | 0 |
| phase3-billing | 66 | 0 | 0 | 0 | 0 |
| phase4-auth | 51 | 0 | 0 | 0 | 0 |
| phase4-ssrf | 69 | 0 | 0 | 0 | 0 |
| phase5-conversations | 52 | 0 | 0 | 0 | 0 |
| phase6-api | 36 | 0 | 0 | 0 | 0 |
| phase6-retries | 18 | 0 | 0 | 0 | 0 |
| phase6-postgres | 57 | 0 | 0 | 0 | 0 |
| phase6-frontend | 9 | 0 | 0 | 0 | 0 |
| phase7-ui | 35 | 0 | 0 | 0 | 0 |
| **Total** | **519** | **0** | **0** | **0** | **0** |

The final complete runner passed all 519 tests. Following the last label/loading-copy corrections, targeted blog-security (33), phase6-frontend (9) and phase7-ui (35) checks also passed: 77 passed, 0 failed/skipped/cancelled.

- TypeScript: node node_modules/typescript/bin/tsc --noEmit, exit 0.
- ESLint: node node_modules/eslint/bin/eslint.js ., exit 0; 0 errors, 1 existing generated-file warning at src/app/.well-known/workflow/v1/flow/route.js:2 (unused eslint-disable directive).
- Production build: Next.js 16.3.4 / Turbopack, exit 0; optimized compilation, TypeScript and 87/87 page-generation tasks passed. Service credential environment variables (OpenAI, Stripe, Lemon Squeezy, email and database, plus key/secret/token/password names) were removed without printing their values. The Pro return page is rendered on demand; this intentionally reduces build page-generation tasks from the prior 88 to 87. The existing parent package-lock.json warning remains.
- Whitespace validation: git diff --check, exit 0.

During development, an expanded Phase 7 run returned 34 passed and 1 failed: the journal error assertion inspected the parent tree rather than the nested ReadError message. The assertion was corrected without weakening application behavior, and all 35 subsequently passed. ESLint also caught the root-error page's ordinary internal anchor; it was replaced with Next Link. Initial sandbox attempts could not start workers (spawn EPERM); approved reruns retained isolation and completed, rather than disabling checks.

## What the new tests establish

35 Phase 7 tests execute real component handlers with mocked React hooks and mocked request boundaries. They cover shared navigation destinations/current page/disclosure, Escape and focus return, link-close behavior, associated labels in eight forms/pages, registration/login-compatible handling, preserved login inputs, duplicate login submissions, source lists and safe URLs, conversation draft switching without AI calls, failed reads, duplicate chat sends and same-key explicit retries, older-message scroll state and explicit jump, interrupted-turn fencing without generation, single checkout invocation and uncertainty messaging, failed logout, four authoritative billing-return states, authentication-versus-network recovery, configuration-derived Pro copy/prices, focus/motion/wrapping rules, GET-only initial chat/quota reads, ignored abandoned quota responses, preserved journal drafts, preserved preceding plans, loading/failed-history presentation and safe explicit error recovery. Earlier suites continue covering Free fifth/sixth requests, Pro boundaries, quota freshness/idempotency, ownership, provenance, authentication, SSRF, billing and database constraints.

These are component/handler and structural/CSS checks. They are not real browser, browser-DOM, axe, viewport-layout or screen-reader tests. No external browser, browser dependency or browser automation was used. No WCAG conformance certification is claimed.

## Remaining risks and deployment prerequisites

1. Mobile/tablet/desktop rendering, 200%/400% zoom, real Tab order, visible focus against every background, actual contrast, native confirmation-dialog focus, assistive-technology announcements and touch behavior remain unverified. Manually check approximately 320/375px, 768px and 1280px widths in a separately authorized environment before production release.
2. Drafts are preserved in component memory for network/server failures and conversation switching in the mounted view. They are not durable autosaves and do not survive a full reload, tab close or navigation away. No new private journal/chat content is written to browser storage. Existing saved messages/source snapshots and the previous personal-operation opaque pending IDs retain their existing persistence behavior.
3. Fencing/recovery does not cancel provider work already dispatched or refund quota. Explicit retries and recovery continue using the previous phases' policies. Ambiguous checkout or deletion still relies on the unchanged server fences and administrator recovery workflow; the UI does not clear them.
4. Missing runtime credentials or unapplied earlier-phase migrations still prevent dependent runtime operations. A credential-free build verifies import/build safety, not live provider/database availability. Phase 7 introduces no migration, new environment variable, new credential or dependency. Deploy earlier prepared migrations/configuration only through the separately approved process; none were executed here.
5. The existing generated workflow ESLint warning and outside-repository parent lockfile build warning remain. No unrelated generated file or parent lockfile was edited.

## Complete Phase 7 changed-file manifest

49 files: 42 existing files modified and 7 new files. New/modified refers to the start of Phase 7, not Git tracking; several earlier-phase files were already uncommitted/untracked. Earlier backend/schema/dependency changes visible in git status are not Phase 7 changes.

| File | Phase 7 status |
|---|---|
| docs/phase-7-ui-accessibility.md | New |
| src/app/account/page.tsx | Modified |
| src/app/admin/blog/[id]/edit/page.tsx | Modified |
| src/app/admin/blog/new/page.tsx | Modified |
| src/app/confession/page.tsx | Modified |
| src/app/dashboard/page.tsx | Modified |
| src/app/error.tsx | New |
| src/app/fasting/page.tsx | Modified |
| src/app/forgot-password/page.tsx | Modified |
| src/app/global-error.tsx | New |
| src/app/globals.css | Modified |
| src/app/history/page.tsx | Modified |
| src/app/journal/page.tsx | Modified |
| src/app/layout.tsx | Modified |
| src/app/loading.tsx | New |
| src/app/not-found.tsx | New |
| src/app/onboarding/page.tsx | Modified |
| src/app/page.tsx | Modified |
| src/app/prayers/page.tsx | Modified |
| src/app/pricing/page.tsx | Modified |
| src/app/pro/page.tsx | Modified |
| src/app/pro/success/page.tsx | Modified |
| src/app/reset-password/page.tsx | Modified |
| src/app/review/clergy/page.tsx | Modified |
| src/app/review/fr-josiah/page.tsx | Modified |
| src/app/scripture/page.tsx | Modified |
| src/app/settings/page.tsx | Modified |
| src/app/today/page.tsx | Modified |
| src/app/verify-email/page.tsx | Modified |
| src/components/auth/LoginForm.tsx | Modified |
| src/components/auth/RegisterForm.tsx | Modified |
| src/components/billing/CheckoutButton.tsx | Modified |
| src/components/billing/CustomerPortalButton.tsx | Modified |
| src/components/blog/BlogContentEditor.tsx | Modified |
| src/components/chat/ChatBox.tsx | Modified |
| src/components/chat/SourceCards.tsx | Modified |
| src/components/layout/Footer.tsx | Modified |
| src/components/layout/LogoutButton.tsx | Modified |
| src/components/layout/NavbarClient.tsx | Modified |
| src/components/layout/ReadError.tsx | New |
| src/components/pro/FastingPlanForm.tsx | Modified |
| src/components/pro/PrayerPlanForm.tsx | Modified |
| src/components/pro/ProStatusCard.tsx | Modified |
| src/components/pro/ScripturePlanForm.tsx | Modified |
| src/components/pro/usePersonalOperation.tsx | Modified |
| src/lib/productCopy.ts | Modified |
| tests/phase4-auth.test.mjs | Modified |
| tests/phase7-ui.test.mjs | New |
| tests/run-regressions.mjs | Modified |

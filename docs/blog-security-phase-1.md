# Blog security: Phase 1

## Authorization and schema assessment

Blog administration now requires BOTH a valid database-backed session whose
current user has `emailVerified`, and explicit provisioning of that user's
immutable database ID in the server-only `BLOG_ADMIN_USER_IDS` environment
variable. Every server action checks this independently, including paste
sanitization. Admin page rendering and edit metadata also check authorization.

`BLOG_ADMIN_EMAILS` no longer grants access. There is deliberately no email
fallback, automatic promotion, public role-assignment endpoint, or registration
field that grants privileges. Registration and ordinary login still work for
unverified users; those sessions cannot administer blogs. The existing session
helper reads the current user from the database, so verification removal and
session revocation take effect on subsequent requests.

A database role/permission table would require a schema migration and a secure
grant/revoke interface. For this project's small, deployment-managed admin list,
explicit server-side provisioning by stable ID provides the required security
boundary without a schema change. The tradeoff is that grants/revocations require
updating server configuration and restarting/redeploying every instance.
Deleting/re-registering the same email creates a different ID and never inherits
the old privileges. No database migration is needed or included.

## HTML policy

`src/lib/blogContent.ts` uses `sanitize-html` with an explicit tag, attribute,
protocol, and CSS allowlist. Writes are sanitized in the server actions. Existing
published posts are sanitized on every public render, and existing drafts and
posts are sanitized before being passed to the rich-text editor. This protects
existing content immediately on deployment without a destructive database
rewrite. The stored originals remain available; saving a post replaces its
content with the sanitized version.

Supported formatting includes headings, paragraphs, line breaks, bold, italics,
underline, lists, quotations, links, code, tables, figures, and HTTP(S)/relative
images. A limited set of typography/alignment styles preserves common Word and
Google Docs formatting. Scripts, handlers, forms, embedded documents, SVG/MathML,
arbitrary classes/IDs, arbitrary CSS, and unsafe protocols are removed. Blank
target links receive `noopener noreferrer`. Protocol-relative, data, JavaScript,
VBScript, and file URLs are disallowed. Remote images can still contact their
origin when a reader views a post.

Legacy plain text is escaped before paragraph/line-break markup is added.
Storage has no format discriminator, so the existing HTML-vs-text heuristic is
retained; text resembling HTML is treated as HTML and sanitized. Entity-encoded
text is never decoded into executable markup.

Rich clipboard HTML is prevented from entering the live editor until an
authorized server action sanitizes it. Plain-text paste uses text insertion.
Drag/drop is disabled to prevent bypassing this paste boundary. Clipboard HTML
needs a server round trip; failed sanitization displays an error without
inserting the content. The sanitizer stays out of the client bundle.

Existing post IDs, slugs, links, statuses, and publication timestamps are not
rewritten by this deployment. Unsupported or unsafe formatting is intentionally
removed from rendered HTML; arbitrary embedded content is not supported.

## Deployment procedure (not executed)

1. Use Node.js 22.12 or newer (the new sanitizer's minimum; local tests used
   Node.js 22.17). Install the lockfile with `npm ci` in the normal build process.
   The existing postinstall generates Prisma's client; it does not apply migrations.
2. Verify each intended administrator's identity and email ownership through a
   trusted channel. Have them complete the normal email verification flow. Do
   not mark arbitrary accounts verified or reuse email allowlists automatically.
3. Obtain each verified account's existing `users.id` through an authorized,
   read-only database lookup. For example, execute this in an operator-controlled
   database console, substituting the actual intended address:

   ```sql
   SELECT id, email, "emailVerified"
   FROM users
   WHERE email = 'verified-administrator@example.com';
   ```

4. Set server-only configuration, for example
   `BLOG_ADMIN_USER_IDS=id-of-verified-admin,id-of-another-verified-admin`.
   Never use a `NEXT_PUBLIC_` prefix. Remove the obsolete `BLOG_ADMIN_EMAILS`
   configuration. An empty/missing ID list denies all blog administration.
5. Run `npm run test:blog-security`, `npx tsc --noEmit --incremental false`, and
   the project's lint/build checks in the deployment environment. Redeploy all
   instances with the new configuration. No migration or content backfill is
   required; do not run `prisma migrate` for Phase 1.
6. Verify a published article, a legacy text article, and a Word/Docs editing
   round trip. Verify that a regular verified account and an unverified account
   cannot access the editor or invoke its actions. Purge any separately managed
   reverse-proxy/CDN HTML caches so previously rendered unsafe HTML is not served.

The regression tests run the actual authorization helper, actions, sanitization,
and server pages with mocked session/database boundaries. They do not connect to
a database or replace browser-based clipboard/visual verification.

## Local validation

- 33 regression tests passed (`npm run test:blog-security`).
- Full TypeScript check passed (`tsc --noEmit --incremental false`).
- ESLint passed for changed application files and the test suite.
- `git diff --check` passed.
- No production build, browser verification, database operations, migrations,
  commits, or pushes were performed. New npm dependencies were installed with
  lifecycle scripts disabled.

Findings outside Phase 1 (billing, quotas, research endpoints, general session
hardening) are unchanged. If exploitation occurred before this patch, review
operator/admin accounts, sessions, and existing posts separately; this patch
does not investigate historical compromise.

## Phase 1B: lazy OpenAI initialization

The 13 modules that previously constructed OpenAI clients at import time now
call `getOpenAI()` only when making an AI request. The shared helper at
`src/lib/ai/openaiClient.ts` imports `server-only`, reads runtime credentials on
first use, and caches a successfully constructed SDK client. Missing credentials
raise `OpenAIConfigurationError` with code `OPENAI_NOT_CONFIGURED`; failed
initialization is not cached. Existing handler error responses remain unchanged.
No models, request payloads, research prompts, retries, timeouts, or embedding
formats were changed. SDK environment configuration, including its existing
admin-key fallback, is preserved. Runtime credential rotation requires restarting
the process once a client has been cached.

`npm run test:openai-initialization` tests import safety for all 13 modules and
the original failing route, missing credentials, lazy initialization, caching,
failed construction, server-only enforcement, and chat/embedding/translation
contracts. OpenAI is mocked, database access is forbidden, and network fetches
are blocked. Credential-presence tests use opaque Symbols in the mocked
environment, not API-key strings or real SDK credentials.

Current validation supersedes the original Phase 1 validation snapshot above:

- Both suites: 54 passed, 0 failed/skipped/cancelled/todo (33 blog + 21 OpenAI).
- Full TypeScript check: exit 0, no diagnostics.
- Repository-wide ESLint: exit 0, 0 errors, 1 unused-disable warning in generated
  `src/app/.well-known/workflow/v1/flow/route.js`; generated code was not edited.
- Production build with `OPENAI_API_KEY`, `OPENAI_ADMIN_KEY`, and database
  connection environment variables removed: compiled successfully in 4.5s and
  passed its TypeScript stage in 6.7s. It then exited 1 during page-data collection
  for `/api/settings/delete`, because existing module-scope Stripe initialization
  at `src/lib/stripe.ts:3` threw `Neither apiKey nor config.authenticator provided`.
  This separate billing issue was not changed. The build also warned about an
  ignored parent-directory lockfile.

No production database, migrations, live AI requests, dummy build credentials,
commits, pushes, or deployments were used. A fully successful production build
remains unverified until the separate Stripe configuration/initialization issue
is addressed under its own authorized scope.

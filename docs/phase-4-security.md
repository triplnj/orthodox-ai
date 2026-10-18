# Phase 4 authentication, sessions and source-fetch security

Local implementation of the approved Phase 4 design and its three additional
requirements. No production systems or customer data were accessed. Email,
payment, AI, source-HTTP and source-DNS interactions in tests were mocked. The
migration is prepared, not applied. Billing, AI quota
definitions, model prompts and source-grounding rules were not changed.

## Registration, verification, login and email recovery

Registration validates the JSON object, email, name and password, reserves abuse
budgets, and hashes the password for both new and existing addresses. It returns
the same 202 acknowledgment in both cases and creates no session. Existing users'
passwords and profiles are untouched. New users stay FREE/unverified; supplied
IDs, roles, plan and verification fields are ignored. The client shows the generic
acknowledgment and a sign-in link preserving `/onboarding` as the destination.

Verification emails retain the 24-hour lifetime. The raw random 32-byte token is
sent only in the email; SHA-256 is stored. Verification atomically marks the user
verified, consumes the token and invalidates sibling verification tokens. The
verification page links to sign-in/onboarding. First login verifies bcrypt and
creates the existing 30-day HttpOnly, SameSite=Lax session (Secure in production).

Unverified users can still log in, as before. They can request another verification
email through the existing settings workflow. This is the recovery path if initial
delivery fails. A resend does not invalidate an older delivered link; successful
verification does. Password-reset requests similarly preserve older valid links
until one reset succeeds. Password-reset links retain their 30-minute lifetime.

Email delivery runs through Next.js `after()` outside the response. A temporary
delivery failure logs a static error code, without recipients, URLs or tokens.
It does not delete the account, change its password, revoke valid tokens or create
a permanent lock. Failed sends still consume bounded recipient limits; the user
can retry after the returned cooldown. Missing email configuration is a delivery
failure rather than silent success. There is no durable email outbox or automatic
unlimited retry in this phase: a terminated background callback requires a manual
resend. Configure a runtime that supports Next.js after/waitUntil correctly.

Unknown/passwordless/wrong-password logins share a generic 401 response. Unknown
and passwordless accounts perform a valid cost-12 dummy bcrypt comparison. Reset
requests and registration acknowledgments do not expose account state in status,
body, or a new registration cookie. Database-work timing differences are reduced,
not a claim of perfect timing indistinguishability under statistical probing.

## Durable rate limits

`AuthRateLimitBucket` uses HMAC-SHA256 identifiers and fixed time windows. Multiple
counter admission is transactional, with sorted PostgreSQL advisory locks, so
concurrent instances cannot overspend a subject's allowance. Database/configuration
failure returns 503; exhausted limits return 429 and Retry-After. Raw addresses,
emails, tokens and passwords are not stored in this table.

| Action | Account/token/user limit | Trusted-IP limit |
| --- | --- | --- |
| Login | 10 / 15 minutes | 300 / 15 minutes |
| Registration | 3 / hour / email | 60 / hour |
| Reset request | 20 / hour / email | 120 / hour |
| Verification resend | 20 / hour / user | 120 / hour |
| Verify/reset submission | 10 / 15 minutes / hashed token | 300 / 15 minutes |
| Password change | 10 / 15 minutes / user | 300 / 15 minutes |
| Source-domain management | 10 / 15 minutes / administrator | 300 / 15 minutes |

All attempted outgoing authentication emails share one recipient budget: one
attempt per fixed minute window and five per fixed hour window, across registration,
reset and resend. Fixed windows allow bursts at a boundary (not a rolling-window
guarantee). Failed email delivery consumes attempts but cannot extend a window.
One failing account does not consume another account's independent allowance.
High IP limits reduce false positives behind shared networks; unusually busy
networks can still reach them. Distributed attacks can temporarily exhaust a
victim's account limit, and provider-specific email aliases are not collapsed.

`AUTH_TRUSTED_IP_HEADER` must name a **single-IP header overwritten by the trusted
ingress**, with direct-origin access prevented. No arbitrary forwarding-chain
selection. Invalid/missing values share `unknown-ingress`; arbitrary X-Forwarded-For
does not bypass enforcement. This fallback is safe but can throttle unrelated users;
verify ingress configuration before rollout. The application cannot establish
header trust merely from its name. Use one consistent, strong secret of at least
32 characters for `AUTH_RATE_LIMIT_SECRET` on every instance. Coordinate secret
rotation, since changing it changes counter identities.

Operational maintenance may delete buckets whose expiresAt is over 24 hours old.
Assign an owner/schedule before rollout; no production cleanup command was run.

## Atomic password and session handling

Login re-reads and verifies the password while holding the per-user authentication
lock, then inserts its session in that transaction. Reset completion, password
change and token issuance use the same lock. Password-reset completion conditionally
claims exactly one unused, unexpired token; password mutation, invalidation of all
other reset tokens and deletion of all sessions commit together. A failure rolls
everything back. Competing identical or sibling-token resets admit one winner.

A password change rechecks the old password under that lock, updates the password,
invalidates reset tokens and deletes all sessions, including the initiating session.
The client is redirected to sign in. A login that commits before revocation has
its session deleted; a login afterward must check the new hash. A cookie set after
a concurrent reset may already be invalid, but cannot recreate a database session.
Revocation does not retroactively cancel already authorized in-flight requests.

Middleware no longer redirects away from authentication pages based on cookie
presence. Server authentication-page guards check the actual session. A stale or
malformed cookie goes through `/api/auth/clear-invalid-session`, which revalidates
the session and clears invalid cookies before redirecting to login. A valid cookie
is preserved. Expired session deletion uses deleteMany, tolerating concurrent
cleanup. Missing/invalid sessions never gain access through cookie presence;
existing page/API authorization remains authoritative.

New passwords require at least eight characters and at most 72 UTF-8 bytes, avoiding
silent bcrypt truncation. Existing login passwords are not truncated by this code;
login/current-password inputs have a 1024-character ceiling. Authentication JSON
is limited to 16 KiB with a five-second read deadline and strict field types.

## Redirects

`safeLoginPath` is shared, client-safe validation. It allows relative application
paths, including safe query strings/fragments, and falls back to `/dashboard`.
External/protocol-relative destinations, unsafe schemes, backslashes, whitespace/
controls, malformed or repeatedly encoded escapes, and API/auth-page destinations
are rejected. URLs are parsed against a fixed origin and normalized before use.
Login uses this helper before router.push; the cleanup route accepts no next URL.

## Source fetching and domain management

All nine patristic network-fetch helpers use the shared server-only transport.
Their extraction, charset/PDF processing, model prompts and grounding checks are
unchanged. Transport authorization does not make a new publisher authoritative
or bypass quote verification.

Initial exact hosts are the configured trusted/curated/authoritative hosts:

- en.wikisource.org, el.wikisource.org, la.wikisource.org,
  commons.wikimedia.org, upload.wikimedia.org, onlinebooks.library.upenn.edu.
- azbyka.ru, pravoslavie.ru, doxologia.ro, svetigora.com, svetosavlje.org,
  churchofcyprus.org.cy, agiooros.org, newadvent.org, orthodoxchurchfathers.com,
  matia.gr, catholiclibrary.org, remacle.org, syri.ac, gorgiaspress.com, vlioras.gr,
  gutenberg.org, archive.org, patrologiagraeca.org, biblegateway.com, philokalia.com;
  each of these has an explicit www variant.

Requests require HTTPS/443, exact DNS hostnames and no URL credentials. IP literals,
numeric-IP aliases, trailing-dot hosts and unsafe URL characters are rejected.
Citation fragments are stripped for the network request while callers retain
their original citation URLs. Resolve A/AAAA records; any private/internal,
non-global, mapped or unsupported transition address fails closed. Pin one checked
address to a fresh HTTPS connection, preserve TLS SNI/certificate hostname checks,
and verify the connected peer. DNS has bounded retries and cancellation. Requests
do not forward cookies/authorization or reuse a previously authenticated socket.

Follow at most five redirects with fresh policy/DNS/peer checks at every hop.
Support same-host relative redirects, explicit apex/www counterparts, UPenn catalog
to Archive.org, Wikimedia source pages to upload.wikimedia.org, and Archive.org
downloads to narrow `ia<digits>.us.archive.org` / `dn<digits>.ca.archive.org` shard
patterns (and between those shards/Archive). Shards are redirect-only initial
destinations. Other cross-host edges require explicit administrator approval.

URL resource profiles bound both streamed wire and decoded sizes:

| Profile | Limit | Overall deadline |
| --- | ---: | ---: |
| Default HTML/JSON/text | 10 MiB | 30 seconds |
| .pdf URLs | 50 MiB | 60 seconds |
| .jpg/.jpeg/.png URLs | 20 MiB | 30 seconds |
| _djvu.xml/_djvu.txt/_scandata.xml URLs | 100 MiB | 60 seconds |

Caller deadlines can shorten these. Connection establishment is limited to 10
seconds. Encoded/chunked bodies cannot bypass size bounds. Error/abort paths destroy
streams and requests. Resource URLs lacking the recognized extensions receive
default limits. Full PDF parsing CPU/heap isolation is outside this phase. The
Node transport does not use Next.js fetch revalidation/Data Cache; existing caller
cache hints are accepted for compatibility but are not a transport cache. Existing
in-memory source-resolution caches remain unchanged; assess network-load changes.

### Adding a domain without code changes

Provision immutable local user IDs in `PATRISTICS_SOURCE_ADMIN_USER_IDS`. This is
separate from worker/research/billing credentials. A worker secret, ordinary user,
unverified account or matching email string cannot manage domains.

An authenticated administrator POSTs JSON to
`/api/admin/patristic-source-domains`:

```json
{
  "hostname": "texts.publisher.example",
  "enabled": true,
  "redirectHosts": [],
  "reason": "Reviewed publisher provenance and primary text collection. Internal review reference: ..."
}
```

This is an illustrative reserved example, not a real source or an instruction to
send a request. Supply an exact hostname, not a URL/path/port/wildcard/IP. A 20–1000
character review note is mandatory; do not put secrets or customer PII in notes.
At most ten exact redirect destinations may be listed; approve each destination
separately first. New hostnames receive public-DNS validation and a DNS-pinned HTTPS
HEAD root probe. The root must return 2xx or an explicitly safe 3xx destination;
there is no automatic redirect bypass. Root HEAD failures may require publisher
cooperation before admission. Administrators attest publisher/content provenance;
the probe verifies DNS/TLS/HTTP reachability, not theological authenticity or domain
ownership. Every actual fetch revalidates DNS and TLS after approval.

Authorization is checked before any probe and rechecked against current verified
user state before mutation. Domain upsert and append-only application audit record
commit together; audit-write failure rolls back authorization. Records include
actor ID, action, timestamp, note, checked addresses and explicit redirect edges.
Failed DNS/HTTPS verification is audited and grants nothing. API callers cannot
edit/delete audits. Database administrators still require normal access controls.

To revoke, send the same exact hostname with enabled:false, redirectHosts:[] and
a reason. Disabling does not need a working DNS/server; a disabled record overrides
even a built-in host. New fetches/redirects are denied. In-flight requests cannot be
retroactively recalled. Retain domain configuration/audit while enabled; review
disabled-domain audit retention after one year under the organization's incident
policy. No automatic audit deletion is enabled.

## Migration and deployment prerequisites

Prepared, NOT EXECUTED:
`prisma/migrations/20261019000000_auth_source_security/migration.sql`.
It transactionally creates AuthRateLimitBucket, PatristicSourceDomain and
PatristicSourceDomainAudit and their indexes. No existing rows, user/password/token/
session columns, billing schema or AI quota tables are changed by this migration.
Prisma Client was regenerated locally; generated files remain Git-ignored.

For a separately approved rollout:

1. Test migration and advisory-lock behavior on disposable PostgreSQL with synthetic
   data. New code requires these tables; apply the additive migration before the
   new application starts. Existing earlier phase migrations remain prerequisites.
2. Configure AUTH_RATE_LIMIT_SECRET consistently, verify ingress-overwritten
   AUTH_TRUSTED_IP_HEADER, and provision PATRISTICS_SOURCE_ADMIN_USER_IDS only for
   trusted verified administrators. Empty administrator configuration grants nobody.
3. Preserve RESEND_API_KEY, EMAIL_FROM and the correct public NEXT_PUBLIC_APP_URL.
   Verify actual email delivery and Next.js after/waitUntil support in staging.
4. Generate Prisma, build and deploy through the normal reviewed process. Drain
   older application instances: their handlers do not share the new authentication
   locks/rate checks, so mixed versions do not provide the full atomic guarantee.
5. Verify real source DNS/TLS/redirect patterns and representative PDFs/OCR sizes
   on staging, including archive shards. No live compatibility claim was made here.
6. Assign bucket cleanup, audit-retention and authentication/email failure monitoring
   owners. Do not weaken fences, source rules or recipient limits to mask errors.

Neither migrations, staging probes, production verification nor deployment were
performed in this task.

## Regression coverage and limits

The integration tests execute real registration/login form handlers, route handlers,
authentication services, cookies/session records and verification steps with
mocked email delivery and a transactional in-memory database. Another integration
uses real bcrypt. They cover successful onboarding and failed initial email
delivery followed by login/resend/verification. These are in-process end-to-end
integration tests, not a claim that Chrome or a live Next server was exercised.

Additional tests cover generic responses, ignored privilege fields, per-account/
shared-IP/concurrent rate limits, recipient cooldown/hourly limits and natural
expiry, same/sibling reset-token races, login/reset races, rollback, session
revocation/expiration/logout, cookie cleanup, malformed/oversized inputs and
malicious redirects. SSRF tests use mocked DNS and HTTPS streams to cover private/
mapped addresses, rebinding/peer mismatch, redirect policies/loops, compression,
stream caps, deadlines, resolver cleanup and domain-management authorization/audit.

PostgreSQL integration, real TLS certificates, browser rendering and delivery-provider
behavior require staging verification. Large shared networks, distributed account
lockout attempts, small timing differences, email aliases, source HEAD behavior,
new CDN redirect patterns, large-file memory consumption and cache/performance
changes remain operational risks. Missing rate-limit configuration fails closed;
missing trusted ingress IP configuration shares a fallback bucket. Do not treat
mock tests alone as proof of production compatibility.

## Complete changed-file manifest

Modified files (26):

```text
middleware.ts
prisma/schema.prisma
src/app/api/auth/forgot-password/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/register/route.ts
src/app/api/auth/resend-verification/route.ts
src/app/api/auth/reset-password/route.ts
src/app/api/auth/verify-email/route.ts
src/app/api/settings/password/route.ts
src/app/login/page.tsx
src/app/register/page.tsx
src/app/settings/page.tsx
src/app/verify-email/page.tsx
src/lib/email.ts
src/lib/patristics/clean-pg-ocr.ts
src/lib/patristics/fetch-source.ts
src/lib/patristics/greek-witness.ts
src/lib/patristics/pg-passage-search.ts
src/lib/patristics/pg-volume-source.ts
src/lib/patristics/pg-work-range.ts
src/lib/patristics/resolve-pg-catalog-volumes.ts
src/lib/patristics/search-wikisource-collection.ts
src/lib/patristics/verify-cleaned-pg.ts
src/lib/session.ts
tests/blog-security.test.mjs
tests/run-regressions.mjs
```

New files (19):

```text
docs/phase-4-security.md
prisma/migrations/20261019000000_auth_source_security/migration.sql
src/app/api/admin/patristic-source-domains/route.ts
src/app/api/auth/clear-invalid-session/route.ts
src/components/auth/LoginForm.tsx
src/components/auth/RegisterForm.tsx
src/lib/security/auth-http.ts
src/lib/security/auth-input.ts
src/lib/security/auth-limits.ts
src/lib/security/auth-page.ts
src/lib/security/auth-service.ts
src/lib/security/public-dns.ts
src/lib/security/redirect.ts
src/lib/security/source-admin.ts
src/lib/security/source-policy.ts
src/lib/security/source-transport.ts
tests/helpers/auth-harness.mjs
tests/phase4-auth.test.mjs
tests/phase4-ssrf.test.mjs
```

The old client login/register forms moved into components; their page URLs remain
unchanged. Existing blog tests were updated to use the new authentication workflow
and valid session-token fixtures, preserving their original security assertions.
No package/dependency changes. Local generated Prisma/build output remains ignored.

## Regression results

| Suite | Passed | Failed | Cancelled | Skipped |
| --- | ---: | ---: | ---: | ---: |
| blog-security | 33 | 0 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 | 0 |
| phase2-security | 45 | 0 | 0 | 0 |
| phase3-billing | 66 | 0 | 0 | 0 |
| phase4-auth | 51 | 0 | 0 | 0 |
| phase4-ssrf | 69 | 0 | 0 | 0 |
| Total | 312 | 0 | 0 | 0 |

Run command: `node tests/run-regressions.mjs`. Process isolation is enabled,
one worker per suite, 30-second per-test timeout and 60-second per-suite process
deadline. A focused Phase 4 rerun also passed after onboarding/stream-cleanup
review. No assertion failures, cancelled tests or skipped tests remain.

Final verification:

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`, exit 0.
- ESLint: `node node_modules/eslint/bin/eslint.js`, exit 0; 0 errors and 1 existing
  unused-eslint-disable warning in generated workflow flow/route.js.
- Final TLS/SSRF rerun: 69 passed, 0 failed/cancelled/skipped, exit 0.
- Production: `node node_modules/next/dist/bin/next build`, exit 0; installed
  Next.js 16.3.4, compiled in 4.1s, build TypeScript finished in 7.0s, all 83/83
  pages generated. App keys/secrets/tokens and email/payment/AI/database credentials
  were removed from the child environment; no local .env files were present.
  Compiled output was checked to include explicit TLS certificate enforcement.
- Build warning: package-lock.json outside the repository was ignored; unrelated
  configuration was not changed.
- `git diff --check`: exit 0; only Git's existing LF/CRLF conversion notices.
- Local Prisma Client generation: exit 0. Its blocked schema-engine download/check
  required approved tool execution; no database connection or migration occurred.

The local React review checked server/client boundaries, stable hook usage,
accessible labels on the moved forms, status feedback, and absence of server-only
dependencies in the client redirect helper. No deployment or commit was performed.

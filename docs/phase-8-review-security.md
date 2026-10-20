# Phase 8 review-identity remediation

Local implementation only, 2026-10-19. No production inspection, account transition, provider call or deployment was performed. No schema change, migration, new dependency or infrastructure change is required for this remediation.

## Ownership and configuration

Both account-provisioning links now use one server-only service. REVIEW_USER_ID binds Fr Josiah review access; REVIEW_CLERGY_USER_ID binds clergy review access. These IDs are operator-controlled authorization decisions, not values supplied by the requester. Never derive an ID from a request or adopt whichever account currently has an email address.

Retain REVIEW_USER_EMAIL / REVIEW_CLERGY_USER_EMAIL and their existing default addresses. Addresses are compared in lowercase; surrounding whitespace is rejected to remain compatible with existing billing protections. IDs must contain 1–128 ASCII letters, digits, underscores or hyphens. Duplicate configured IDs, duplicate case-insensitive emails, malformed values and missing bindings fail closed. An unconfigured, unused review role may remain unbound, but its provisioning route cannot issue access.

REVIEW_ACCESS_TOKEN and REVIEW_CLERGY_ACCESS_TOKEN remain secret bearer credentials. The service checks them without comparing raw strings directly. Never publish them or include them in logs, screenshots, tickets or analytics. IDs are not secrets and must not confer administrative privileges; do not include review users in blog, billing, research or source-administration allowlists.

The service checks both the configured ID and email inside a transaction. An email belonging to another ID, an ID belonging to another email, any password-bearing account, unverified/FREE/inactive state, deletion fence, provider identifiers, billing-access dates, subscription records or checkout records causes a conflict. No colliding user is edited, merged, elevated or signed in. Do not clear passwords or payment references to force an account through these checks.

If neither ID nor email exists, a dedicated passwordless, verified PRO user is created with the explicitly configured ID. Legitimate existing dedicated identities retain their profile and data. Review PRO is the existing operator-provided entitlement, not evidence of a payment or ownership of an external mailbox.

Registration reserves the review email addresses even when provisioning tokens are disabled. It returns the existing uniform registration acknowledgment without creating a password/account or sending a verification message. Ordinary collision owners retain ordinary login access if their ID is not the explicitly bound dedicated identity.

Dedicated review IDs cannot use password login, reset/verification issuance, outstanding reset/verification token consumption or password change. Existing authentication limits and generic acknowledgments remain in force. Token-only `/api/review/chat` retains its current implementation, quota principal and grounding behavior. Unsetting REVIEW_ACCESS_TOKEN also disables that separate token-only chat because it shares the credential.

## Concurrency and sessions

Provisioning takes the normalized-email registration advisory lock, then the existing per-user authentication advisory lock, inside a ReadCommitted transaction. This coordinates registration, review starts, password/session mutations and operator transitions. Existing unique ID/email constraints are the final collision guard. Session persistence happens in that transaction; the HTTP cookie is set only after commit. Session cookie flags, expiry and existing review quota/rate limits are unchanged.

Repeated valid review links may create separate legitimate sessions. They do not revoke other legitimate review sessions or reset user preferences. Cookie delivery failure can leave a persisted session whose cookie was not delivered; it grants no access without the random secret and expires under normal session rules.

## Mandatory legacy transition — operator authorization required

**Keep both provisioning links disabled until the fixed deployment and all legacy-account remediation are complete.** Disable/remove their access tokens across every old/new application replica before rollout. Token removal alone does not revoke already-issued sessions or attacker passwords.

1. Obtain explicit approval in the operational change system for each legacy identity. Record the accountable operator, approval reference, intended user ID, role and email. Review configuration access is privileged. A matching email, display name, verified flag or PRO state is not sufficient evidence of legitimate provenance.
2. Have an authorized operator review the existing identity and its provenance in an approved maintenance context. No such production review was performed here. If ownership is uncertain, password-bearing or linked to billing, leave it unchanged and choose a separate clean review identity/email. Do not move or merge its messages, journals, payment records or user data.
3. Configure REVIEW_USER_ID and/or REVIEW_CLERGY_USER_ID to the explicitly approved identity, retaining consistent emails. Keep review access tokens disabled. Drain old application replicas and sensitive authentication writes; older code does not implement these new safeguards.
4. In a trusted, operator-controlled server execution context, explicitly invoke the internal library function `transitionLegacyReviewIdentity(kind, { actor, reference, confirmUserId })` from `src/lib/security/review-provisioning.ts`. `kind` is `fr-josiah` or `clergy`; confirmUserId must exactly match the configured ID. This is not a public API or server action. Do not create an HTTP wrapper accepting these fields from users. The actor/reference fields record approved authority; they do not authenticate an untrusted caller.
5. The function revalidates the binding/account and refuses unsafe collisions, then atomically deletes that user's sessions and marks every outstanding reset and verification token used. It never edits the user or password. Session deletion and both token invalidations roll back together on failure. It emits `REVIEW_IDENTITY_TRANSITION` with IDs, counts, timestamp, actor and approval reference after commit. Retain this structured evidence in the approved audit record; no new durable audit table was introduced.
6. Independently confirm the approved user's old sessions are revoked, outstanding tokens are invalidated, and account/data ownership is unchanged. Capture completion evidence for each identity. The deployment process must not enable links merely because IDs have been configured: configuration is trusted operator authority, not an automatic certificate that the transition was executed.
7. Only after the fixed deployment is complete and all transition evidence is approved, enable freshly rotated review tokens and privately distribute the correct links. Legitimate reviewers sign in again through their review links and retain their history. Test first with synthetic isolated identities; any production operation requires separate authorization.

For a new identity with neither ID nor email present, no legacy adoption is needed. Use a fresh unguessable operator-selected ID and an unused dedicated email. Never recycle a retired review ID/email without an explicit security review, and preserve bindings while legacy data/sessions remain so credential guards are not accidentally removed.

If an audit log delivery fails after a transition commits, do not assume rollback: inspect the approved identity and record the outcome. A deliberate repeat transition is safe for ownership but revokes any sessions issued since the prior transition; do not automatically retry it. Operator mistakes in privileged configuration cannot be solved by trusting email strings again.

## Verification and limitations

The mocked suite covers both roles, attacker/ordinary collisions, wrong-ID/email state, password-bearing bound users, valid provisioning, concurrent starts/registration, repeat access, bad/opposite-role tokens, alternate credential paths, stale tokens/sessions, approved and rejected legacy transitions, configuration conflicts, billing ambiguity, uniform acknowledgments, rollback and concurrent reset/transition.

The native suite deep-compares collision users, sessions, reset/verification tokens and chat messages before/after both provisioning endpoints. Real PostgreSQL concurrency verifies one passwordless dedicated identity under competing registration/provisioning; real transitions invalidate sessions/tokens without changing user data. All payment/email/AI boundaries are mocked. It creates and deletes only a synthetic database after checking temporary directory, version, PID, address, port, start time and database OID.

Existing provider, quota, billing and grounding behavior is unchanged. Production identity provenance, legacy transition completion, shared-link confidentiality and deployment of the fixed artifact remain operational release prerequisites. No actual browser or production access was performed.

## Exact local verification results

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| blog-security | 33 | 0 | 0 |
| openai-initialization | 21 | 0 | 0 |
| stripe-initialization | 27 | 0 | 0 |
| phase2-security | 45 | 0 | 0 |
| phase3-billing | 66 | 0 | 0 |
| phase4-auth | 51 | 0 | 0 |
| phase4-ssrf | 69 | 0 | 0 |
| phase5-conversations | 52 | 0 | 0 |
| phase6-api | 36 | 0 | 0 |
| phase6-retries | 18 | 0 | 0 |
| phase6-postgres (embedded PGlite) | 57 | 0 | 0 |
| phase6-frontend | 9 | 0 | 0 |
| phase7-ui | 35 | 0 | 0 |
| phase8-review-security (new mocked suite) | 44 | 0 | 0 |
| phase8-postgres (native PostgreSQL 17.11, pgvector available) | 31 | 0 | 0 |
| **Total** | **594** | **0** | **0** |

All final suites exited 0, with zero cancelled cases. Commands: `node tests/run-regressions.mjs` and `node tests/run-regressions.mjs phase8-postgres`. The native fixture replayed the full historical vector chain with no BOM normalizations. It deleted only its newly created database, `phase8_c4a193b1a6a3`, after identity/OID verification.

* TypeScript (`tsc --noEmit`): exit 0.
* ESLint (`eslint .`): exit 0; 0 errors, 1 existing generated-file warning in `src/app/.well-known/workflow/v1/flow/route.js:2`.
* Prisma validation: exit 0; schema valid; no schema changes.
* Credential-free Next.js 16.3.4 production build: exit 0; compiled in 6.8 seconds, TypeScript completed in 9.3 seconds, 87/87 pages generated. Existing parent-directory lockfile warning remains.
* `git diff --check`: exit 0.

The first focused mocked run had 41 passes and 1 failure out of 42: a reset request immediately following registration hit the unchanged legitimate email cooldown (429). Splitting these admissions into independent fixtures corrected the test, and two additional transition tests brought the final mocked suite to 44/44. No rate-limit policy was relaxed. Sandbox worker spawning initially failed with EPERM; execution approval permitted the isolated runner. Initial Prisma validation was blocked by sandbox networking; approved validation succeeded. These infrastructure attempts are not failed final regression cases.

The separately approved earlier Prisma-engine rehearsal already passed all 17 migrations and seven vector/integrity checks after the three-byte billing BOM correction. This remediation did not alter those migrations or rerun that temporary command; the current native suite separately verified the updated application behavior using synthetic data.

## Files changed for this remediation

1. `src/lib/security/review-identities.ts` (new): server-side binding and configuration validation.
2. `src/lib/security/review-provisioning.ts` (new): collision-safe shared provisioning, session creation and operator-only transition.
3. `src/lib/security/auth-service.ts`: dedicated-identity credential guards and reserved registration emails.
4. `src/app/api/review/fr-josiah/start/route.ts`: shared service and safe conflict/configuration responses.
5. `src/app/api/review/clergy/start/route.ts`: same protections for clergy review.
6. `tests/helpers/auth-harness.mjs`: billing-state mock boundaries needed to test adoption refusal.
7. `tests/phase2-security.test.mjs`: isolate the new provisioning boundary in existing quota/authorization tests.
8. `tests/phase8-review-security.test.mjs` (new): 44 review-security cases.
9. `tests/phase8-postgres.test.mjs`: exact collision preservation, native races/transitions and cleanup identity checks.
10. `tests/run-regressions.mjs`: include the new mocked suite by default; native PostgreSQL remains an explicit isolated run.
11. `docs/phase-8-review-security.md` (new): configuration, transition runbook, results and manifest.
12. `docs/phase-8-environment.md`: the two new ID bindings.
13. `docs/phase-8-readiness.md`: current status addendum; retain original audit evidence.
14. `docs/phase-8-change-inventory.md`: refreshed repository-wide inventory.

No billing service, quota values, model configuration, prompts, source-grounding logic, schema, migration, package manifest or dependency lockfile changed for this remediation. The previously approved billing BOM-only change remains a separate earlier Phase 8 correction.

## Remaining release gates

The preclaim fix passes local regressions, but the deployed application has not been changed. Keep provisioning links disabled until approved deployment, identity provenance review and atomic legacy revocation are complete. The temporary database was deleted; the underlying disposable PostgreSQL server was not stopped or otherwise changed in this task.

Other Phase 8 gates remain: authorized representative upgrade/backup/rollback rehearsal; legacy billing reconciliation and bounded outage behavior; private-query log redaction; verified retention scheduling and workflow/provider-budget configuration; production quota/timezone/ingress configuration; and manual accessibility verification. Existing bearer review links remain reusable secrets and require controlled distribution/rotation. No production-ready claim is made from synthetic tests alone. **Overall Phase 8 recommendation remains NO-GO pending release gates.**

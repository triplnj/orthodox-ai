# OrthodoxAI GitHub handoff — local preparation only

This is a transfer of the current local work, not a release approval. No additional development, tests, builds, database operations, migration execution, staging, commit, push, merge or deployment was performed to prepare this handoff. Only this note and its exact file manifest were added.

## Branch, history and scope

Verified branch: `audit/orthodoxai-hardening`. Current HEAD: `c7fa8b0`.

Configured remote `origin` was inspected locally: `https://github.com/triplnj/orthodox-ai.git`, with no embedded credentials or query string. No network operation was performed. The branch has no configured upstream; the proposed push below uses `-u`.

The existing history already contains Phases 1–4:

| Commit | Existing work |
| --- | --- |
| `b5ce381` | Blog authorization/sanitization and lazy AI/Stripe initialization |
| `e1b3a71` | Research API authorization, atomic quotas and job protection |
| `2cae244` | Billing subscriptions, checkout/deletion fences and recovery |
| `c7fa8b0` | Authentication/session/reset protection and source-fetch security |

The Phase 1 comparison base is `41e4baf`. These four existing commits are retained. The proposed single new handoff commit captures the remaining working-tree changes, including follow-ups to earlier phases; it does not rewrite, squash or amend the existing history.

At initial handoff inspection: **120 modified tracked files, 51 untracked files, zero staged files**. Against the Phase 1 base there were 178 net tracked changed paths plus 51 untracked paths, covering 229 files. After adding this note and the manifest, the proposed commit contains **173 files: 120 modified and 53 new**, with zero deletions. The complete branch work spans 231 net paths including these two handoff documents.

**Exact proposed commit file list:** [github-handoff-files.txt](github-handoff-files.txt). Every line is a literal repository-relative file path. No directory-wide staging or `git add .` is proposed. `phase-8-change-inventory.md` is an earlier inventory snapshot; this manifest supersedes its counts for the actual handoff commit.

## Included work

The proposed files contain Phase 5 conversation ownership/context/idempotency and immutable source snapshots; Phase 6 validation, durable private-response recovery, quota reporting and structured errors; Phase 7 responsive navigation, accessibility and safe user recovery; and Phase 8 review-account preclaim protection, the approved billing BOM correction, bounded legacy reconciliation, privacy-safe diagnostics, tests and reports. Package changes add the approved tokenizer and in-memory SQL test dependency, with the lockfile retained. Existing Phase 1–4 application files, migration history and reports not changed since HEAD remain present through the retained commits.

The current schema includes the approved additive conversation/provenance, reservation-integrity and nullable legacy-deadline changes. The historical `prisma/proposed-migrations/phase-3-billing-integrity.sql` is already tracked reference material; it is not an additional migration to execute.

## Secret and artifact inspection

Read-only inspection covered all 229 pre-handoff Phase 1–8 net changed/new files (1,736,717 bytes), plus high-confidence added-secret patterns in the four existing hardening commits. No application code was executed. No high-confidence private-key/provider-token/GitHub-token/AWS-token matches or credential-bearing database URLs were found. Five secret-assignment pattern matches were reviewed: all are explicit synthetic review/provider test fixtures in `tests/phase2-security.test.mjs`, `tests/phase3-billing.test.mjs` and `tests/phase8-postgres.test.mjs`.

No `.env` files, key/certificate files, dependency/build/generated directories, native binaries, database files, PostgreSQL data/configuration, rehearsal helpers, logs or symlinks appear in the proposed manifest. Tracked-file checks found no `.env`, generated Prisma client, `.next` or `node_modules` artifacts. Existing ignore rules cover `.env*`, `node_modules`, `.next`, `src/generated/prisma`, TypeScript build information and generated workflow routes. They were not changed. Package-lock integrity values and synthetic fixture values are not production credentials. This is a scoped local handoff scan, not a certification of unrelated repository history before Phase 1.

Keep all portable PostgreSQL/pgvector installations, data, downloads, build outputs, diagnostic transformers, rehearsal scripts and raw test logs under the local temporary directory, outside the repository. The legitimate `tests/phase8-postgres.test.mjs` is test source, not a PostgreSQL artifact. It is deliberately bound to the old temporary instance's identity and must not be run automatically by the receiving developer. The temporary server may still be running; its previously blocked shutdown is an operator cleanup item, not an instruction to stop an unrelated PostgreSQL service.

## Migration integrity — do not execute

Git currently warns about future LF/CRLF conversion. Stage the four migration files separately with command-local `core.autocrlf=false`, then verify index bytes against raw file bytes before any commit. No repository/global Git configuration is changed by the proposed commands.

| Proposed migration file | SHA-256 of current raw bytes |
| --- | --- |
| `prisma/migrations/20261018000000_billing_integrity/migration.sql` | `cb94ffb165a970f1d07f92de1a307f9bdf508fc4ad4ae008927dc49d8e446a39` |
| `prisma/migrations/20261019000000_conversation_memory_provenance/migration.sql` | `0f93001228f7510a95cab159456327182eb8d51226f35f761432f38f6c1f8692` |
| `prisma/migrations/20261020000000_api_quota_integrity/migration.sql` | `d333a2597b9f4fbe764faad11d259adeb4669b8ea77e1dc91f0b6cd3c0e34172` |
| `prisma/migrations/20261021000000_bounded_legacy_reconciliation/migration.sql` | `a2852001bb5e375e88c1cd125006fd2b061d86f729c53b0defece34fb311e344` |

The existing billing migration change removes only its previously approved leading UTF-8 BOM. Its original SHA-256 was `6a40b1648bef951e4c2700860a3d286a26d28ea3b78efeb6182e067abc3e1e1f`; the corrected value is above. The full 17-migration rehearsal passed earlier on a new disposable database. That historical result does not cover the new eighteenth legacy-reconciliation migration, which remains unapplied and requires separately authorized native trigger/concurrency/UTC validation and a coordinated cutover. No production migration execution is implied by handing over the files.

## Recorded verification and release state — not rerun for handoff

* Last complete regression run: **624 passed, 0 failed, 0 skipped, 0 cancelled; exit 0**, including 53 privacy/legacy cases and 73 billing cases. Exact per-suite results are in [phase-8-billing-privacy.md](phase-8-billing-privacy.md).
* TypeScript passed, including the latest completed build's TypeScript stage.
* Offline Prisma validation and client generation passed previously using the existing engine. The most recent additional validation request did not execute because execution approval returned `rejected by user`; it is not a new schema failure or a new validation success.
* Last completed ESLint run passed with one existing generated-file warning; it preceded the final Web Crypto/helper-test adjustment.
* Latest completed credential-free build compiled and passed TypeScript, then failed page-data collection for `/_not-found` because nonempty inherited `DEBUG` triggered the production privacy guard. A clean-environment rerun was rejected by execution approval and never executed. The guard was not bypassed or weakened.
* Native PostgreSQL security/migration results from the earlier review fix are historical. No native database or migration runner was invoked for the latest correction or handoff. The existing default regression runner excludes the native suite. Do not use unreviewed automatic test discovery, which could select the native suite and apply migrations.

**Production recommendation remains NO-GO.** The receiving developer needs separately authorized final clean-environment build/lint confirmation, native verification of migration 18, controlled deployment cutover with old workers drained and sensitive writes paused, reconciliation of uncertain legacy ownership within the immutable deadline, review-account transition evidence before enabling links, and operational seven-day log retention/historical private-log remediation. Existing environment, upgrade/restore and manual accessibility gates remain unverified. See [phase-8-environment.md](phase-8-environment.md), [phase-8-review-security.md](phase-8-review-security.md), [phase-8-billing-privacy.md](phase-8-billing-privacy.md) and the historical [phase-8-readiness.md](phase-8-readiness.md). Newer addenda take precedence over historical claims.

## Proposed staging and review commands — NOT EXECUTED

Run only after approval of this manifest. These commands stage exactly the listed files and do not commit, push, build, test or execute migrations.

```powershell
Set-Location -LiteralPath 'C:\Users\User\Projects\orthodox-ai'
if ((git branch --show-current).Trim() -ne 'audit/orthodoxai-hardening') {
    throw 'Wrong branch; stop.'
}
if ((git rev-parse --short=7 HEAD).Trim() -ne 'c7fa8b0') {
    throw 'HEAD changed since handoff review; stop.'
}
if (@(git diff --cached --name-only).Count -ne 0) {
    throw 'Unexpected staged changes; stop.'
}
$handoffFiles = @(Get-Content -LiteralPath 'docs/github-handoff-files.txt' -Encoding UTF8)
if ($handoffFiles.Count -ne 173 -or @($handoffFiles | Sort-Object -Unique).Count -ne 173) {
    throw 'Invalid handoff manifest; stop.'
}
$actualChanges = @((@(git -c core.safecrlf=false diff --name-only HEAD) +
    @(git ls-files --others --exclude-standard)) | Sort-Object -Unique)
if (@(Compare-Object $handoffFiles $actualChanges).Count -ne 0) {
    throw 'Working-tree file list changed; stop and review.'
}
$handoffMigrations = @($handoffFiles | Where-Object { $_ -like 'prisma/migrations/*/migration.sql' })
$handoffOtherFiles = @($handoffFiles | Where-Object { $_ -notlike 'prisma/migrations/*/migration.sql' })
if ($handoffMigrations.Count -ne 4) { throw 'Unexpected migration scope; stop.' }
git --literal-pathspecs add -- $handoffOtherFiles
if ($LASTEXITCODE -ne 0) { throw 'Application/report staging failed; stop.' }
git -c core.autocrlf=false --literal-pathspecs add -- $handoffMigrations
if ($LASTEXITCODE -ne 0) { throw 'Migration staging failed; stop.' }
foreach ($handoffMigration in $handoffMigrations) {
    $rawBlob = (git hash-object --no-filters -- $handoffMigration).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Raw migration hashing failed; stop.' }
    $indexBlob = (git rev-parse --verify ":$handoffMigration").Trim()
    if ($LASTEXITCODE -ne 0 -or $rawBlob -ne $indexBlob) {
        throw "Staged migration bytes differ: $handoffMigration"
    }
}
$stagedFiles = @(git diff --cached --name-only)
if (@(Compare-Object $handoffFiles $stagedFiles).Count -ne 0) {
    throw 'Staged file list differs from approved manifest; stop.'
}
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged whitespace check failed; stop.' }
git diff --cached --stat
git diff --cached --name-status
git diff --cached --no-ext-diff --no-textconv
```

Before committing, compare the raw migration SHA-256 values with the table above, inspect the full staged diff for credentials/unwanted content, and review the staged file list. A mismatch requires stopping, not deleting files, forcing an update or suppressing checks. The initial handoff inspection found no active repository hooks or configured `core.hooksPath`; recheck before any later approved commit if the environment changes.

## Proposed single commit — separate approval required, NOT EXECUTED

```powershell
git commit -m "chore: hand off OrthodoxAI hardening phases 1-8" -m "Preserve existing Phase 1-4 history and capture remaining application, regression, migration and report work. Record unresolved build, native migration and operational release gates; no deployment approval."
```

The commit command must not be appended to the staging/review block and run without the final review and explicit approval.

## Proposed GitHub push — separate approval required, NOT EXECUTED

After the approved commit, the exact normal push command is:

```powershell
git push -u origin audit/orthodoxai-hardening
```

No commit or push has been executed or is authorized for execution yet. If the normal push is rejected, stop; do not force-push, merge, rebase, reset or amend automatically. No deployment is proposed. Transfer secrets through the receiving team's separate secure channel; none belong in GitHub issues, commit text or this handoff.

# OrthodoxAI — isolated patristic source automation

This process deliberately does **not** integrate with production chat, authentication, payments, production Neon, or Vercel runtime.

## 1. Automatic source preview (zero secrets)

Workflow: `.github/workflows/patristic-source-preview-qa.yml`

On changes to source extraction/QA code, GitHub Actions:
- tests the extractor, the lossless chunker and the source audit;
- downloads two public-domain NPNF source previews from Wikisource;
- validates that the expected works and minimum observed paragraph counts appear;
- records SHA-256 for each reconstructed source and **manifestSha256** for the entire exact JSON source batch;
- uploads `patristic-source-preview-qa` artifact with the preview and audit JSON.

The result remains `REQUIRES_EDITORIAL_REVIEW` regardless of automated checks. Paragraph count alone does **not** establish completeness. No embeddings are generated and no Neon connection is used.

## 2. One-time permission setup — only when staging import is approved

GitHub → repository **Settings** → **Environments** → create an environment exactly named
`patristic-library-staging`. If available, configure required reviewers and restrict
deployments to the trusted default branch. If branch protection or approval is not
available on the plan, the manual typed confirmation and reviewed hash remain mandatory.

Add these two repository/environment **Actions secrets** (never commit values):
- `LIBRARY_STAGING_DB_URL`: **only** the existing isolated Neon staging database connection string, never production;
- `LIBRARY_STAGING_BRANCH_ID`: exact staging branch identifier with its guard marker (currently `br-spring-frost-assfzje6`).

The staging database has a one-row guard:
`LibraryStagingGuard.branchId = LIBRARY_STAGING_BRANCH_ID`,
`purpose = PATRISTIC_LIBRARY_STAGING`.
Scripts refuse to write when the guard does not match.

Do not expose credentials in chat or logs. Rotate any previously shared database password.

## 3. Manually reviewed staging import

Review `patristic-first-batch.preview.json` and `patristic-source-audit.json`
from the same **successful** source-preview workflow run. Confirm the source passages,
original edition, page boundaries, text completeness, translation rights and provenance.
Copy the `manifestSha256` field from the audit JSON.

GitHub → Actions → **Patristic Library - Approved Staging Import** → Run workflow:
- `reviewed_manifest_sha256`: exactly the SHA-256 of the preview you reviewed;
- `confirmation`: `STAGE_REVIEWED_SOURCE_ONLY`.

The workflow fetches fresh sources, checks that the content hash **still matches**
and requires staging DB secrets and its guard before inserting into the `STAGED` state.
The stored texts and hashes are verified inside a DB transaction; on any mismatch the
transaction rolls back. The job does not create embeddings or activate content.

If the Wikisource content changes between preview and import, the run fails closed:
repeat preview and review; do **not** reuse old hashes.

## 4. Pending (not yet automated)

- Semantic embedding of new staging editions only after editorial review and an explicit cost budget.
- Source-aware retrieval QA across multiple fathers, without duplicate author confusion.
- Theologically grounded response generation and guarded feature-flag integration in live OrthodoxAI.
- Larger and multilingual corpus discovery with source and translation permissions.

**Operational limit:** GitHub connector access used to author workflow files does not
currently expose a general trigger/list API for push-triggered Actions runs in this
conversation. A committed workflow is not proof a runner has executed successfully.
Verify on the GitHub Actions page before relying on automated results.

/**
 * Chat-only QA allowance for one test identity in one isolated PR preview.
 * Does not grant PRO, paid features, billing entitlements or admin access.
 * A branch-scoped setting alone cannot enable this in production.
 * VERCEL_GIT_COMMIT_REF is optional in Vercel runtime environments; when
 * present it must match, and when absent the branch-scoped env markers
 * plus Preview-only guard and exact user/DB identity are required.
 */
const QA_BRANCH = "feature/patristic-bibliography-step5-answer-audit-20261111";
const QA_DB_BRANCH = "br-fancy-recipe-astk5ot6";
const QA_USER_ID = "pr61_preview_test_20261112";

export function isIsolatedPreviewQaChatUser(userId: string): boolean {
  return userId === QA_USER_ID
    && process.env.VERCEL_ENV === "preview"
    && (!process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_GIT_COMMIT_REF === QA_BRANCH)
    && process.env.ORTHODOXAI_CHAT_ISOLATED_PREVIEW === "true"
    && process.env.ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID === QA_DB_BRANCH
    && process.env.ORTHODOXAI_PREVIEW_QA_CHAT === "enabled";
}

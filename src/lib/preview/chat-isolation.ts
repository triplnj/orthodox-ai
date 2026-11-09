/** Fail-closed guard before ANY chat authentication, quota, or conversation writes.
 * This preview branch is cloned from a database that initially contained real user data.
 * Never allow inherited generic Preview DATABASE_URL to serve Chat.
 */
const TEST_BRANCH="experiment/patristic-catalog-author-v2-20261109";
const ISOLATED_DB_BRANCH="br-empty-breeze-asd2dqrq";
export type PreviewCounts={
 users:bigint|number;nonTestUsers:bigint|number;sessions:bigint|number;conversations:bigint|number;
 chatTurns:bigint|number;messages:bigint|number;emailTokens:bigint|number;
 resetTokens:bigint|number;journals:bigint|number;usageLogs:bigint|number;
 reservations:bigint|number;feedback:bigint|number;
};
export type PreviewGuardRow={branchId:string;purpose:string}&PreviewCounts;
export function assertIsolatedPreviewConfig(env:NodeJS.ProcessEnv=process.env){
 if(env.VERCEL_ENV!=="preview"||env.VERCEL_GIT_COMMIT_REF!==TEST_BRANCH)return false;
 if(env.ORTHODOXAI_CHAT_ISOLATED_PREVIEW!=="1"||
   env.ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID!==ISOLATED_DB_BRANCH)
  throw Error("PREVIEW_CHAT_BLOCKED: isolation configuration missing");
 if(!env.DATABASE_URL||!env.DIRECT_URL)
  throw Error("PREVIEW_CHAT_BLOCKED: branch-specific database credentials missing");
 const connection=new URL(env.DATABASE_URL);
 if(!["postgres:","postgresql:"].includes(connection.protocol)||
   !connection.hostname.toLowerCase().endsWith(".neon.tech"))
  throw Error("PREVIEW_CHAT_BLOCKED: invalid database host");
 return true;
}
export function assertIsolatedPreviewDatabase(rows:PreviewGuardRow[]){
 if(rows.length!==1||rows[0].branchId!==ISOLATED_DB_BRANCH||
   rows[0].purpose!=="PATRISTIC_CHAT_ISOLATED_PREVIEW")
  throw Error("PREVIEW_CHAT_BLOCKED: database guard does not prove isolation");
 const r=rows[0];
 if(BigInt(r.nonTestUsers)!==BigInt(0))throw Error("PREVIEW_CHAT_BLOCKED: unapproved user accounts remain");
 // Once scrubbed, QA may create accounts only using the dedicated @example.test domain.
 // The branch marker itself must only be set AFTER a zero-data sanitization audit.
}
export async function enforceChatPreviewIsolation(
 fetchGuard:()=>Promise<PreviewGuardRow[]>,
 env:NodeJS.ProcessEnv=process.env
){
 if(!assertIsolatedPreviewConfig(env))return;
 // Query uses one fixed SQL literal, not data supplied by callers.
 const rows=await fetchGuard();
 assertIsolatedPreviewDatabase(rows);
}

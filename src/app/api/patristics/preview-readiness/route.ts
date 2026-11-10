import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {assertIsolatedPreviewConfig,enforceChatPreviewIsolation,type PreviewGuardRow} from "@/lib/preview/chat-isolation";
import {buildIsolatedGregoryResearch} from "@/lib/patristics/preview-gregory-research";

/** Read-only Preview-only QA health check; never expose credentials, texts, users or source URLs. */
export async function GET(){
 try{
  if(!assertIsolatedPreviewConfig())return new Response(null,{status:404});
  await enforceChatPreviewIsolation(async()=>prisma.$queryRaw<PreviewGuardRow[]>`
   SELECT g."branchId",g."purpose",
    (SELECT count(*) FROM users) "users",
    (SELECT count(*) FROM users WHERE lower("email") NOT LIKE '%@example.test') "nonTestUsers",
    (SELECT count(*) FROM sessions) "sessions",
    (SELECT count(*) FROM "Conversation") "conversations",
    (SELECT count(*) FROM "ChatTurn") "chatTurns",
    (SELECT count(*) FROM chat_messages) "messages",
    (SELECT count(*) FROM email_verification_tokens) "emailTokens",
    (SELECT count(*) FROM password_reset_tokens) "resetTokens",
    (SELECT count(*) FROM journal_entries) "journals",
    (SELECT count(*) FROM usage_logs) "usageLogs",
    (SELECT count(*) FROM "AiReservation") "reservations",
    (SELECT count(*) FROM "UserActivationFeedback") "feedback"
   FROM "LibraryStagingGuard" g`);
  const research=await buildIsolatedGregoryResearch("How does Macrina comfort Gregory of Nyssa in his grief after Basil died?");
  const valid=research?.sources.length===3 &&
   research.providersSucceeded.includes("PROTECTED_STAGING_GREGORY") &&
   research.sources.every(s=>s.verificationStatus==="STAGING_TEXT_MATCH_ONLY"&&
      s.metadata?.speakerVerified===false&&s.metadata?.exactQuoteAllowed===false);
  if(!valid)throw Error("Failed protected source-only QA validation");
  // Reproduce the real second user turn, both standalone and with a preceding
  // permitted grief question in the retrieval context. Neither may use sources.
  const unsupported="What does Gregory of Nyssa teach about the immortality of the soul?";
  const standalone=await buildIsolatedGregoryResearch(unsupported);
  const composite="How does Macrina console Gregory of Nyssa after Basil's death?\\nFollow-up question: "+unsupported;
  const followUp=await buildIsolatedGregoryResearch(composite,process.env,unsupported);
  const bothRefused=[standalone,followUp].every(r=>r&&r.sources.length===0&&
    r.providersAttempted.includes("PROTECTED_STAGING_GREGORY")&&r.providersSucceeded.length===0);
  if(!bothRefused)throw Error("A broad Gregory claim escaped the current-turn evidence gate");
  return NextResponse.json({status:"READY",environment:"ISOLATED_PREVIEW",
   sourceProvider:"PROTECTED_STAGING_GREGORY",
   selectedSourceCount:3,unsupportedSoulQuestionRejected:bothRefused,
   unsupportedFollowUpRejected:bothRefused,exactQuoteApproved:false,speakerAutoVerified:false,
   authenticatedChatTested:false},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({status:"BLOCKED"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}

/**
 * Read-only source-context inspection of a previously produced JSON benchmark.
 * Usage:
 *   node scripts/patristics/inspect-30-paragraph-context-staging.mjs path/to/report.json
 *
 * No new embeddings, ranking changes, source promotion or writes. The report
 * must come from the original 30-question benchmark; this script checks
 * protected staging markers and unchanged source hashes before inspection.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import pg from "pg";
import {loadReferenceSets} from "./evaluate-30-evidence-staging.mjs";
import {analyzeParagraphContext} from "./paragraph-context-diagnostic.mjs";
const {Client}=pg;
const BRANCH="br-spring-frost-assfzje6";
export function validateContextInputs(env,report,fixtures){
 if(!env.LIBRARY_STAGING_DB_URL||env.LIBRARY_STAGING_BRANCH_ID!==BRANCH)
  throw Error("Refusing missing or wrong staging branch");
 const url=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(url.protocol)||!/\.neon\.tech$/i.test(url.hostname)||
   !url.username||url.pathname==="/")
  throw Error("Refusing non-Neon staging URL");
 if(report?.status!=="PROVISIONAL_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION"||
   report.branchId!==BRANCH||report.questionCount!==30||
   !Array.isArray(report.questions)||report.questions.length!==30||
   report.indexed!==281||report.total!==285)
  throw Error("Wrong report or changed corpus coverage");
 if(fixtures.questions.length!==30||fixtures.evidence.length!==61)
  throw Error("Reference fixtures changed");
 const expected=new Set(fixtures.questions.map(q=>q.id));
 if(new Set(report.questions.map(q=>q.questionId)).size!==30||
   report.questions.some(q=>!expected.has(q.questionId)))
  throw Error("Question mapping mismatch");
}
export async function inspectContext(env,report,fixtures=loadReferenceSets(),deps={}){
 validateContextInputs(env,report,fixtures);
 const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||
    guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Protected staging marker mismatch");
  const count=await db.query('SELECT count(*)::integer AS total,count(embedding)::integer AS indexed FROM "LibraryPassage"');
  if(Number(count.rows[0]?.total)!==285||Number(count.rows[0]?.indexed)!==281)
   throw Error("Staging corpus changed");
  const ids=[...new Set([
   ...fixtures.evidence.map(e=>e.passageId),
   ...report.questions.flatMap(q=>["all-authors","expected-author"].flatMap(scope=>
    ["baselineTop10","rerankedTop10"].flatMap(method=>
      (q.searches?.[scope]?.[method]??[]).map(hit=>hit.passageId))))
  ])];
  const rows=await db.query(String.raw`
   WITH anchors AS (
     SELECT DISTINCT p."editionId",p."locator"
     FROM "LibraryPassage" p WHERE p."id"=ANY($1::text[])
   )
   SELECT p."id" AS "passageId",p."editionId",p."locator",p."ordinal",
     p."contentSha256",p."content",
     a."speakerName",a."statementKind",a."attributionStatus"
   FROM "LibraryPassage" p
   JOIN anchors ON anchors."editionId"=p."editionId" AND anchors."locator"=p."locator"
   LEFT JOIN "LibraryPassageAttribution" a ON a."passageId"=p."id"
   ORDER BY p."editionId",p."locator",p."ordinal"
  `,[ids]);
  const catalog=rows.rows;
  const present=new Map(catalog.map(x=>[x.passageId,x]));
  for(const e of fixtures.evidence){
   const row=present.get(e.passageId);
   if(!row||row.editionId!==e.editionId||row.contentSha256!==e.contentSha256)
    throw Error("Reference evidence content changed: "+e.questionId);
  }
  const results=[];
  for(const q of report.questions){
   for(const scope of ["all-authors","expected-author"]){
    for(const method of ["baseline","reranked"]){
     const ranked=q.searches[scope][method+"Top10"];
     if(ranked.length>10||ranked.some((x,i)=>x.rank!==i+1))
      throw Error("Invalid pre-existing ranking order");
     const diagnostic=analyzeParagraphContext({
      questionId:q.questionId,retrieved:ranked,
      evidence:fixtures.evidence,catalog
     });
     results.push({questionId:q.questionId,scope,method,
       originalHit10:q.searches[scope][method]["hit@10"],
       exactHitCount:diagnostic.exactHitCount,
       nearParagraphCount:diagnostic.nearParagraphCount,
       nearGroups:diagnostic.contextGroups
         .filter(g=>g.status==="SAME_PARAGRAPH_NOT_SAME_EVIDENCE")
         .map(g=>({locator:g.locator,firstRetrievedRank:g.firstRetrievedRank,
           unreturnedReferenceChunks:g.unreturnedReferenceChunks,
           mixedSpeakerOrStatement:g.mixedSpeakerOrStatement,
           unreviewedAttribution:g.unreviewedAttribution,
           attributionByChunk:g.attributionByChunk}))
     });
    }
   }
  }
  return {
   status:"CONTEXT_DIAGNOSTICS_ONLY_GROUND_TRUTH_UNCHANGED",
   branchId:BRANCH,questionCount:30,
   sourceReportStatus:report.status,inspectedPassages:catalog.length,
   allQuestions:results,
   rerankedGlobalMisses:results.filter(r=>r.scope==="all-authors"&&r.method==="reranked"&&r.originalHit10===0),
   caveat:"Paragraph overlap is not an exact passage hit. Mixed dialogue and unreviewed speaker attributions demand human review. No gold labels or baseline scores changed."
  };
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const name=process.argv[2];
  if(!name)throw Error("Provide an existing original report.json path");
  inspectContext(process.env,JSON.parse(readFileSync(name,"utf8")))
    .then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
    .catch(e=>{process.stderr.write("CONTEXT_INSPECTION_FAILED: "+e.message+"\n");process.exitCode=1;});
 }catch(e){process.stderr.write("CONTEXT_INSPECTION_FAILED: "+e.message+"\n");process.exitCode=1;}
}

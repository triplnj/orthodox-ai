/**
 * Held-out works (Athanasius and Cyril) compared across ALL indexed staging
 * editions. Does not alter the fixed baseline algorithms or source annotations.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import pg from "pg";
import OpenAI from "openai";
import {prepareSourceBatch} from "./prepare-source-batch.mjs";
import {validateEmbeddingResponse} from "./benchmark-retrieval-staging.mjs";
import {rerankCandidates} from "./rerank-retrieval.mjs";
import {evaluateRankedList,aggregateScores} from "./evidence-retrieval-metrics.mjs";
const {Client}=pg;
const BRANCH="br-spring-frost-assfzje6";
export function validateNewWorksBenchmark(plan,manifest,stage,env){
 if(plan?.purpose!=="CROSS_WORK_QUESTION_PLAN_NOT_YET_EVALUATED"||
    plan.questions?.length!==8||stage?.status!=="TWO_NEW_WORKS_STAGED_UNREVIEWED"||
    stage.branchId!==BRANCH||env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||
    !env.LIBRARY_STAGING_DB_URL||!env.OPENAI_API_KEY)throw Error("New works staging approval/fixtures missing");
 const u=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(u.protocol)||!/\.neon\.tech$/i.test(u.hostname)||!u.username)
  throw Error("Refusing non-Neon staging endpoint");
 const prepared=prepareSourceBatch(manifest);
 if(prepared.counts.passages!==10||prepared.counts.editions!==2||
    prepared.works.some(w=>!stage.editionIds.includes(w.editionId)))
  throw Error("New works source identity changed");
 const byWork=new Map(prepared.works.map(w=>[w.author+"|"+w.title,w]));
 const targets=plan.questions.map(q=>{
  const work=byWork.get(q.author+"|"+q.work);
  const source=work&&prepared.passages.find(p=>p.editionId===work.editionId&&p.locator===q.locator);
  if(!source||q.sourcePassageId!==null||
    q.editorialStatus!=="QUESTION_SOURCE_SECTION_IDENTIFIED_PENDING_TEXT_AND_CITATION_REVIEW")
   throw Error("Question source was not pinned and staged: "+q.id);
  return {...q,passageId:source.id,sourceSha256:source.sha256};
 });
 if(new Set(targets.map(x=>x.id)).size!==8||new Set(targets.map(x=>x.question)).size!==8||
    targets.some(x=>x.question.length>1000))throw Error("Unexpected benchmark questions");
 const bytes=targets.reduce((sum,q)=>sum+Buffer.byteLength(q.question),0);
 if(bytes*10*0.02/1_000_000>0.01)throw Error("Benchmark API budget exceeded");
 return {prepared,targets};
}
export async function evaluateNewWorks(plan,manifest,stage,env=process.env,deps={}){
 const {prepared,targets}=validateNewWorksBenchmark(plan,manifest,stage,env);
 const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 const ai=deps.ai??new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0});
 await db.connect();
 try{
  const g=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(g.rows.length!==1||g.rows[0].branchId!==BRANCH||
    g.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")throw Error("Wrong protected Neon branch");
  const coverage=await db.query('SELECT count(*)::int AS total,count(embedding)::int AS indexed FROM "LibraryPassage"');
  if(Number(coverage.rows[0]?.total)!==295||Number(coverage.rows[0]?.indexed)!==291)
   throw Error("Unexpected staged corpus: refuse measurement");
  const rows=await db.query(String.raw`
    SELECT "id","editionId","contentSha256",("embedding" IS NOT NULL) AS embedded
    FROM "LibraryPassage" WHERE "editionId"=ANY($1::text[])
  `,[stage.editionIds]);
  const expected=new Map(prepared.passages.map(p=>[p.id,p]));
  if(rows.rows.length!==10)throw Error("New source passage count mismatch");
  for(const row of rows.rows){
   const ref=expected.get(row.id);
   if(!ref||ref.editionId!==row.editionId||ref.sha256!==row.contentSha256||
      !row.embedded)throw Error("Source hash/embedding mismatch");
  }
  const vectors=validateEmbeddingResponse(await ai.embeddings.create({
    model:"text-embedding-3-small",input:targets.map(x=>x.question),encoding_format:"float"
  }),targets.length);
  const sql=String.raw`
    SELECT p."id" AS "passageId",p."content",p."locator",
      e."sourceUrl",a."canonicalName" AS author,
      1-(p."embedding" <=> $1::vector) AS similarity
    FROM "LibraryPassage" p
    JOIN "LibraryEdition" e ON e."id"=p."editionId"
    JOIN "LibraryWork" w ON w."id"=e."workId"
    JOIN "LibraryAuthor" a ON a."id"=w."authorId"
    WHERE e."importStatus"='STAGED' AND p."embedding" IS NOT NULL
      AND ($2::text IS NULL OR a."canonicalName"=$2)
    ORDER BY p."embedding" <=> $1::vector,p."id" LIMIT 20
  `;
  const results=[];
  for(let i=0;i<targets.length;i++){
   const t=targets[i],scopes={};
   for(const [scope,author] of [["all-authors",null],["expected-author",t.author]]){
    const candidates=(await db.query(sql,["["+vectors[i].join(",")+"]",author])).rows;
    const baseline=candidates.slice(0,10);
    const reranked=rerankCandidates(t.question,candidates,{limit:10});
    const relevant=new Map([[t.passageId,2]]);
    const details=hits=>hits.map((x,k)=>({rank:k+1,passageId:x.passageId,
     author:x.author,locator:x.locator,sourceUrl:x.sourceUrl,
     relevant:x.passageId===t.passageId,similarity:Number(x.similarity)}));
    scopes[scope]={baseline:evaluateRankedList(baseline,relevant),
      reranked:evaluateRankedList(reranked,relevant),
      baselineTop10:details(baseline),rerankedTop10:details(reranked)};
   }
   results.push({questionId:t.id,question:t.question,author:t.author,
     targetPassageId:t.passageId,targetLocator:t.locator,scopes});
  }
  const summary={};
  for(const scope of ["all-authors","expected-author"]){
   const data=results.map(r=>({baseline:r.scopes[scope].baseline,reranked:r.scopes[scope].reranked}));
   summary[scope]={baseline:aggregateScores(data,"baseline"),reranked:aggregateScores(data,"reranked")};
  }
  return {status:"NEW_WORK_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION",
    branchId:BRANCH,questionCount:8,sourcePassages:10,
    totalPassages:295,indexedPassages:291,summary,questions:results,
    caveat:"Questions are new-work section anchors, not doctrinal certification; generated passage IDs are source-backed."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [planFile,manifestFile,stageFile]=process.argv.slice(2);
  if(!planFile||!manifestFile||!stageFile)throw Error("Provide question plan, manifest and staging result");
  evaluateNewWorks(JSON.parse(readFileSync(planFile)),JSON.parse(readFileSync(manifestFile)),JSON.parse(readFileSync(stageFile)))
   .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
   .catch(e=>{process.stderr.write("NEW_WORKS_QA_FAILED: "+e.message+"\n");process.exitCode=1;});
 }catch(e){process.stderr.write("NEW_WORKS_QA_FAILED: "+e.message+"\n");process.exitCode=1;}
}

/**
 * One-off English-only offline evaluation of 30 source-checked questions.
 * Compares exact original vector similarity with current fixed reranker.
 * 30 query vectors in one bounded OpenAI call; exclusively SELECT on the
 * staging-guarded Neon branch. No production paths, updates, answer synthesis
 * or assertion that provisional evidence constitutes certified theology.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import pg from "pg";
import {FROZEN_INDEXED_SQL,FROZEN_TOTAL_SQL} from "./frozen-baseline-corpus.mjs";
import OpenAI from "openai";
import {rerankCandidates} from "./rerank-retrieval.mjs";
import {validateEmbeddingResponse} from "./benchmark-retrieval-staging.mjs";
import {KS,relevantEvidence,evaluateRankedList,aggregateScores} from "./evidence-retrieval-metrics.mjs";

const {Client}=pg;
const MODEL="text-embedding-3-small";
const EXPECTED_INDEXED=281;
const BRANCH="br-spring-frost-assfzje6";
export function loadReferenceSets(read=readFileSync){
 const questions=JSON.parse(read("tests/fixtures/patristic-english-30-questions.json","utf8")).questions;
 const evidence=JSON.parse(read("tests/fixtures/patristic-english-30-evidence.json","utf8")).items;
 if(questions?.length!==30||evidence?.length!==61||new Set(questions.map(q=>q.id)).size!==30)
   throw Error("Source-checked reference fixtures changed");
 for(const q of questions){
  if(q.language!=="en"||q.reviewStatus!=="SOURCE_TEXT_CHECKED_PENDING_EDITORIAL_APPROVAL")
   throw Error("Refusing unreviewed or non-English benchmark question");
  const ids=evidence.filter(x=>x.questionId===q.id).map(x=>x.passageId);
  if(JSON.stringify(ids)!==JSON.stringify(q.relevantPassageIds))
   throw Error("Evidence question mapping mismatch "+q.id);
  if(!relevantEvidence(q.id,evidence).size)throw Error("Missing positive evidence "+q.id);
 }
 return {questions,evidence};
}
export function validateEnvironment(env,questions){
 const raw=env.LIBRARY_STAGING_DB_URL;
 if(!raw||!env.LIBRARY_STAGING_BRANCH_ID||!env.OPENAI_API_KEY)
   throw Error("Missing isolated staging secrets");
 const url=new URL(raw);
 if(!["postgres:","postgresql:"].includes(url.protocol)||!/\.neon\.tech$/i.test(url.hostname)||!url.username||
   !url.pathname||url.pathname==="/"||env.LIBRARY_STAGING_BRANCH_ID!==BRANCH)
   throw Error("Refusing non-approved Neon staging branch");
 const bytes=questions.reduce((n,q)=>n+Buffer.byteLength(q.question,"utf8"),0);
 const maxEstimatedUSD=bytes*10*0.02/1_000_000;
 if(bytes>15000||maxEstimatedUSD>0.01)
   throw Error("Embedding preflight exceeds approved 1-cent benchmark budget");
 return {sourceQuestionBytes:bytes,conservativePreflightUSD:maxEstimatedUSD,model:MODEL};
}
export async function runEvidenceBenchmark(env=process.env,deps={}){
 const {questions,evidence}=deps.fixtures??loadReferenceSets();
 const budget=validateEnvironment(env,questions);
 const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 const ai=deps.ai??new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0});
 await db.connect();
 try{
  const marker=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(marker.rows.length!==1||marker.rows[0].branchId!==BRANCH||
     marker.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Wrong staging database: no embeddings requested");
  const count=await db.query('SELECT count(*)::integer AS total,count(embedding)::integer AS indexed FROM "LibraryPassage" WHERE "editionId" IN (${FROZEN_TOTAL_SQL})');
  if(count.rows.length!==1||Number(count.rows[0].indexed)!==EXPECTED_INDEXED)
   throw Error("Unexpected corpus coverage: no embeddings requested");
  const indexedRefs=await db.query('SELECT "id","editionId","contentSha256" FROM "LibraryPassage" WHERE "id"=ANY($1::text[])',
    [[...new Set(evidence.map(x=>x.passageId))]]);
  if(indexedRefs.rows.length!==new Set(evidence.map(x=>x.passageId)).size)
   throw Error("Evidence source passages missing");
  const refById=new Map(indexedRefs.rows.map(x=>[x.id,x]));
  for(const ref of evidence){
   const row=refById.get(ref.passageId);
   if(!row||row.editionId!==ref.editionId||row.contentSha256!==ref.contentSha256)
    throw Error("Evidence source content changed: "+ref.questionId);
  }
  const response=await ai.embeddings.create({model:MODEL,
    input:questions.map(x=>x.question),encoding_format:"float"});
  const vectors=validateEmbeddingResponse(response,questions.length);
  const rows=[];
  const sql=String.raw`
    SELECT p."id" AS "passageId",p."content",a."canonicalName" AS "author",
      e."id" AS "editionId",e."sourceUrl",p."locator",
      1-(p."embedding" <=> $1::vector) AS "similarity"
    FROM "LibraryPassage" p
    JOIN "LibraryEdition" e ON e."id"=p."editionId"
    JOIN "LibraryWork" w ON w."id"=e."workId"
    JOIN "LibraryAuthor" a ON a."id"=w."authorId"
    WHERE e."importStatus"='STAGED' AND p."embedding" IS NOT NULL AND e."id" IN (${FROZEN_INDEXED_SQL})
      AND ($2::text IS NULL OR a."canonicalName"=$2)
    ORDER BY p."embedding" <=> $1::vector,p."id"
    LIMIT 20
  `;
  for(let i=0;i<questions.length;i++){
   const q=questions[i],relevant=relevantEvidence(q.id,evidence);
   const vector="["+vectors[i].join(",")+"]";
   const searches={};
   for(const [scope,author] of [["all-authors",null],["expected-author",q.expectedAuthor]]){
    const hits=(await db.query(sql,[vector,author])).rows;
    const baseline=hits.slice(0,10);
    const reranked=rerankCandidates(q.question,hits,{limit:10});
    searches[scope]={
     baseline:evaluateRankedList(baseline,relevant),
     reranked:evaluateRankedList(reranked,relevant),
     baselineTop10:baseline.map((x,j)=>({
       rank:j+1,passageId:x.passageId,author:x.author,locator:x.locator,similarity:Number(x.similarity),
       role:evidence.find(e=>e.questionId===q.id&&e.passageId===x.passageId)?.role??null,
       sourceUrl:x.sourceUrl
     })),
     rerankedTop10:reranked.map((x,j)=>({
       rank:j+1,passageId:x.passageId,author:x.author,locator:x.locator,
       similarity:Number(x.similarity),rerankScore:x.rerankScore,
       role:evidence.find(e=>e.questionId===q.id&&e.passageId===x.passageId)?.role??null,
       sourceUrl:x.sourceUrl
     }))
    };
   }
   rows.push({questionId:q.id,question:q.question,expectedAuthor:q.expectedAuthor,
     positiveEvidenceCount:relevant.size,evidenceStatus:q.reviewStatus,searches});
  }
  const summary={};
  for(const scope of ["all-authors","expected-author"]){
   const flat=rows.map(x=>({baseline:x.searches[scope].baseline,reranked:x.searches[scope].reranked}));
   summary[scope]={baseline:aggregateScores(flat,"baseline"),reranked:aggregateScores(flat,"reranked")};
   summary[scope].delta=Object.fromEntries(Object.keys(summary[scope].baseline)
     .map(k=>[k,Number((summary[scope].reranked[k]-summary[scope].baseline[k]).toFixed(5))]));
  }
  return {status:"PROVISIONAL_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION",
    branchId:BRANCH,questionCount:questions.length,
    indexed:Number(count.rows[0].indexed),total:Number(count.rows[0].total),
    ...budget,ks:KS,
    relevanceNote:"Editor-suggested evidence labels are not independent theological certification; objection passages count positive only when question directly asks for the objection.",
    summary,questions:rows};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runEvidenceBenchmark().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
  .catch(e=>{process.stderr.write("EVIDENCE_BENCHMARK_FAILED: "+e.message+"\n");process.exitCode=1;});
}

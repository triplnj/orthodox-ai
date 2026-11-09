/**
 * Read-only multi-author retrieval benchmark. One OpenAI embedding batch of up
 * to eight questions and SELECT-only SQL against the protected Neon staging
 * branch. No answer synthesis, edition activation, migrations or writes.
 *
 * Produces candidate retrieval diagnostics, NOT verification of a theological
 * claim or automatic editorial approval.
 */
import pg from "pg";
import OpenAI from "openai";
import {pathToFileURL} from "node:url";
import {assessPassageEvidence} from "./assess-passage-evidence.mjs";
import {rerankCandidates} from "./rerank-retrieval.mjs";

const {Client}=pg;
export const CASES=Object.freeze([
 {id:"basil-creation-en",question:"How does Basil the Great interpret the beginning of creation in the Hexaemeron?",expectedAuthor:"St. Basil the Great"},
 {id:"basil-creation-sr",question:"Шта Свети Василије Велики говори о стварању света у Шестодневу?",expectedAuthor:"St. Basil the Great"},
 {id:"chrysostom-scripture-en",question:"Why does John Chrysostom speak about needing the written Scriptures in his first homily on Matthew?",expectedAuthor:"St. John Chrysostom"},
 {id:"chrysostom-scripture-sr",question:"Шта Свети Јован Златоусти учи о читању Светог Писма у првој беседи на Матеја?",expectedAuthor:"St. John Chrysostom"},
 {id:"gregory-soul-en",question:"How does Gregory of Nyssa discuss the soul and resurrection in his dialogue with Macrina?",expectedAuthor:"St. Gregory of Nyssa"},
 {id:"gregory-soul-sr",question:"Како Свети Григорије Ниски разматра душу и васкрсење у разговору са Макрином?",expectedAuthor:"St. Gregory of Nyssa"}
]);
const EXPECTED_INDEXED=281;
const MAX_USD=0.01;
const PRICE_PER_MILLION=0.02; // OpenAI text-embedding-3-small input-token price
const MODEL="text-embedding-3-small";
const MAX_QUERY_BYTES=12000;
const toVector=v=>"["+v.join(",")+"]";

export function validateBenchmarkConfiguration(env){
 const raw=env.LIBRARY_STAGING_DB_URL;
 if(!raw||!env.LIBRARY_STAGING_BRANCH_ID||!env.OPENAI_API_KEY)
   throw Error("Staging Neon credentials and OpenAI key are required");
 const url=new URL(raw);
 if(!["postgres:","postgresql:"].includes(url.protocol)||
   !/\.neon\.tech$/i.test(url.hostname)||
   !url.username||!url.pathname||url.pathname==="/"||
   !/^br-[a-z0-9-]+$/.test(env.LIBRARY_STAGING_BRANCH_ID))
   throw Error("Refusing non-Neon or invalid staging configuration");
 const bytes=CASES.reduce((n,c)=>n+Buffer.byteLength(c.question,"utf8"),0);
 if(bytes>MAX_QUERY_BYTES || bytes*10*PRICE_PER_MILLION/1_000_000>MAX_USD)
   throw Error("Retrieval benchmark cost limit exceeded");
 return {maxBudgetUSD:MAX_USD,questionBytes:bytes,model:MODEL};
}
export function validateEmbeddingResponse(response,count){
 const data=response?.data;
 if(!Array.isArray(data)||data.length!==count)
   throw Error("Embedding batch count mismatch");
 const sorted=[...data].sort((a,b)=>a.index-b.index);
 for(let i=0;i<count;i++){
   const v=sorted[i]?.embedding;
   if(sorted[i]?.index!==i||!Array.isArray(v)||v.length!==1536||
      v.some(x=>typeof x!=="number"||!Number.isFinite(x)))
     throw Error("Embedding batch contains invalid vector "+i);
 }
 return sorted.map(x=>x.embedding);
}
function projectHit(r){
 const evidence=assessPassageEvidence(r);
 return {
   author:r.author,work:r.work,sourceUrl:r.sourceUrl,locator:r.locator,
   passageId:r.passageId,similarity:Number(Number(r.similarity).toFixed(5)),
   ...(r.rerankScore===undefined?{}:{rerankScore:r.rerankScore,lexicalCoverage:r.lexicalCoverage,paratextPenalty:r.paratextPenalty,originalRank:r.originalRank}),
   excerpt:r.content.slice(0,220),evidenceRole:evidence.evidenceRole,
   mayPresentAsAuthorTeaching:evidence.mayPresentAsAuthorTeaching
 };
}
export async function benchmarkRetrieval(env=process.env,deps={}){
 const budget=validateBenchmarkConfiguration(env);
 const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 const ai=deps.ai??new OpenAI({apiKey:env.OPENAI_API_KEY});
 await db.connect();
 try{
   const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
   if(guard.rows.length!==1||guard.rows[0].branchId!==env.LIBRARY_STAGING_BRANCH_ID||
     guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
     throw Error("Wrong Neon branch: aborting before OpenAI request");
   const coverage=await db.query(
     'SELECT count(*)::integer AS total, count("embedding")::integer AS indexed FROM "LibraryPassage"');
   if(coverage.rows.length!==1||Number(coverage.rows[0].indexed)!==EXPECTED_INDEXED)
     throw Error("Indexed staging corpus changed; inspect before benchmarking");
   const response=await ai.embeddings.create({
     model:MODEL,input:CASES.map(c=>c.question),encoding_format:"float"
   });
   const vectors=validateEmbeddingResponse(response,CASES.length);
   const reports=[];
   for(let i=0;i<CASES.length;i++){
     const c=CASES[i],v=toVector(vectors[i]);
     const sql=String.raw`
       SELECT a."canonicalName" AS author,w."title" AS work,
         e."sourceUrl" AS "sourceUrl",p."locator" AS locator,
         p."id" AS "passageId",p."content" AS content,
         1-(p."embedding" <=> $1::vector) AS similarity,
         attr."speakerName" AS "speakerName",
         attr."statementKind" AS "statementKind",
         attr."attributionStatus" AS "attributionStatus",
         attr."evidenceUrl" AS "attributionEvidenceUrl"
       FROM "LibraryPassage" p
       JOIN "LibraryEdition" e ON e."id"=p."editionId"
       JOIN "LibraryWork" w ON w."id"=e."workId"
       JOIN "LibraryAuthor" a ON a."id"=w."authorId"
       LEFT JOIN "LibraryPassageAttribution" attr ON attr."passageId"=p."id"
       WHERE e."importStatus"='STAGED' AND p."embedding" IS NOT NULL
         AND ($2::text IS NULL OR a."canonicalName"=$2)
       ORDER BY p."embedding" <=> $1::vector,p."id"
       LIMIT $3
     `;
     // First measure unfiltered performance; then independently verify an
     // author-scoped result, grouping all duplicate IDs under canonical name.
     // Preserve raw vector ranking as the control group. Rerank an expanded
     // candidate set using deterministic English text signals, with no LLM
     // synthesis and no possibility of promoting claims to accepted doctrine.
     const global=await db.query(sql,[v,null,20]);
     const scoped=await db.query(sql,[v,c.expectedAuthor,12]);
     const baselineTop5=global.rows.slice(0,5).map(projectHit);
     const top5=rerankCandidates(c.question,global.rows,{limit:5}).map(projectHit);
     const scopedTop3=rerankCandidates(c.question,scoped.rows,{limit:3}).map(projectHit);
     const firstExpected=top5.findIndex(hit=>hit.author===c.expectedAuthor);
     const baselineRank=baselineTop5.findIndex(hit=>hit.author===c.expectedAuthor);
     reports.push({
       id:c.id,question:c.question,expectedAuthor:c.expectedAuthor,
       baselineAuthorRankTop5:baselineRank<0?null:baselineRank+1,
       authorRankTop5:firstExpected<0?null:firstExpected+1,
       authorAppearsTop5:firstExpected!==-1,
       scopedAuthorResults:scopedTop3.length,
       baselineTop5,top5,scopedTop3
     });
   }
   return {
     status:"RETRIEVAL_DIAGNOSTICS_ONLY",branchId:env.LIBRARY_STAGING_BRANCH_ID,
     indexedPassages:Number(coverage.rows[0].indexed),totalPassages:Number(coverage.rows[0].total),
     ...budget,questions:CASES.length,
     authorRecallAt5:Number((reports.filter(x=>x.authorAppearsTop5).length/reports.length).toFixed(3)),
     missingScopedResults:reports.filter(x=>x.scopedAuthorResults===0).map(x=>x.id),
     reports,
     caveat:"Rank and similarity are diagnostics, not proof of correct doctrine or accurate quotations. Every staged source requires human verification."
   };
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 benchmarkRetrieval().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
  .catch(e=>{process.stderr.write("BENCHMARK_FAILED: "+e.message+"\n");process.exitCode=1;});
}

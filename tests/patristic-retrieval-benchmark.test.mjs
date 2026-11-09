import test from "node:test";
import assert from "node:assert/strict";
import {benchmarkRetrieval,CASES,validateEmbeddingResponse,validateBenchmarkConfiguration} from "../scripts/patristics/benchmark-retrieval-staging.mjs";

const env={
 LIBRARY_STAGING_DB_URL:"postgresql://tester:mock@ep-qa.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 OPENAI_API_KEY:"mock-test-key-not-real"
};
const vector=Array(1536).fill(0.01);
function fakeDb({guard=true,embedded=281}={}){
 const queries=[];
 const db={
  queries,async connect(){},async end(){},
  async query(sql,args){
   queries.push({sql,args});
   if(sql.includes('"LibraryStagingGuard"'))
     return {rows:guard?[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]:[]};
   if(sql.includes('count("embedding")'))return {rows:[{total:285,indexed:embedded}]};
   if(sql.includes('JOIN "LibraryEdition"')){
     const author=args[1]??"St. Basil the Great";
     return {rows:[{author,work:"Source Work",sourceUrl:"https://en.wikisource.org/wiki/Source",
       locator:"Source paragraph 001",passageId:"p1",content:"This is a source excerpt.",
       similarity:0.79,attributionStatus:"UNREVIEWED",speakerName:null,
       statementKind:"UNDETERMINED",attributionEvidenceUrl:null}]};
   }
   throw Error("Unexpected SQL: "+sql);
  }
 };
 return db;
}
test("benchmark checks staging, uses one bounded batch, and runs only SELECTs",async()=>{
 const db=fakeDb();let apiCalls=0;
 const ai={embeddings:{async create(req){
   apiCalls++;
   assert.equal(req.model,"text-embedding-3-small");
   assert.equal(req.input.length,CASES.length);
   return {data:CASES.map((_,index)=>({index,embedding:vector}))};
 }}};
 const report=await benchmarkRetrieval(env,{db,ai});
 assert.equal(apiCalls,1);
 assert.equal(report.questions,6);
 assert.equal(report.reports.length,6);
 assert.equal(report.indexedPassages,281);
 assert.equal(report.missingScopedResults.length,0);
 assert.ok(report.reports.every(r=>r.scopedTop3[0].mayPresentAsAuthorTeaching===false));
 assert.ok(db.queries.every(q=>/^\s*SELECT\b/i.test(q.sql)));
 assert.equal(db.queries.filter(q=>q.args?.length===3).length,12);
 assert.ok(db.queries.filter(q=>q.args?.length===3).every(q=>q.sql.includes('a."canonicalName"=$2')));
});
test("bad staging guard blocks embedding request",async()=>{
 const db=fakeDb({guard:false});let called=false;
 await assert.rejects(benchmarkRetrieval(env,{db,ai:{embeddings:{create:async()=>{called=true;}}}}),/Wrong Neon branch/);
 assert.equal(called,false);
});
test("incorrect corpus coverage blocks embedding request",async()=>{
 const db=fakeDb({embedded:0});let called=false;
 await assert.rejects(benchmarkRetrieval(env,{db,ai:{embeddings:{create:async()=>{called=true;}}}}),/corpus changed/);
 assert.equal(called,false);
});
test("invalid vector response rejected",()=>{
 assert.throws(()=>validateEmbeddingResponse({data:[{index:0,embedding:[1]}]},1),/invalid vector/);
 assert.throws(()=>validateEmbeddingResponse({data:[]},1),/count mismatch/);
});
test("non-Neon URL rejected before any connection",()=>{
 assert.throws(()=>validateBenchmarkConfiguration({...env,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/live"}),/non-Neon/);
});

test("English-only evaluation leaves Serbian cases out and preserves baseline",async()=>{
 const db=fakeDb();const batches=[];
 const ai={embeddings:{async create(req){
   batches.push(req.input);
   return {data:req.input.map((_,index)=>({index,embedding:vector}))};
 }}};
 const result=await benchmarkRetrieval({...env,PATRISTIC_ENGLISH_ONLY:"true"},{db,ai});
 assert.equal(result.questions,3);
 assert.equal(batches.length,1);
 assert.equal(batches[0].length,3);
 assert.ok(result.reports.every(x=>x.id.endsWith("-en")));
 assert.ok(result.reports.every(x=>x.baselineTop5.length===1&&x.top5.length===1));
 assert.ok(result.reports.every(x=>x.top5[0].originalRank===1));
});

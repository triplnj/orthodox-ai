import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadReferenceSets,validateEnvironment,runHoldoutBenchmark} from "../scripts/patristics/evaluate-12-holdout-staging.mjs";
import {relevantEvidence} from "../scripts/patristics/evidence-retrieval-metrics.mjs";
const fixture=loadReferenceSets();
const env={LIBRARY_STAGING_DB_URL:"postgresql://tester:mock@ep-test.eu-central-1.aws.neon.tech/neondb",LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",OPENAI_API_KEY:"test-only"};
const v1=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-evidence.json","utf8"));
const v2=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-evidence-v2-review-candidates.json","utf8"));
test("twelve unused holdout questions and evidence IDs stay disjoint from original references",()=>{
 assert.equal(fixture.questions.length,12);
 assert.equal(fixture.evidence.length,12);
 const used=new Set([...v1.items,...v2.candidates].map(x=>x.passageId));
 assert.ok(fixture.evidence.every(x=>!used.has(x.passageId)));
 assert.equal(new Set(fixture.evidence.map(x=>x.passageId)).size,12);
 assert.equal(new Set(fixture.questions.map(x=>x.question.toLowerCase())).size,12);
 assert.ok(fixture.questions.every(q=>q.holdoutStatus==="FROZEN_BEFORE_FIRST_HOLDOUT_RUN"));
 assert.ok(fixture.questions.every(q=>relevantEvidence(q.id,fixture.evidence).size===1));
 for(const author of ["St. Basil the Great","St. John Chrysostom","St. Gregory of Nyssa"])
  assert.ok(fixture.questions.some(q=>q.expectedAuthor===author));
});
test("holdout benchmark validates isolated branch before a single paid embedding batch",async()=>{
 const db={queries:[],async connect(){},async end(){},
  async query(sql,args){
   this.queries.push(sql);
   if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
   if(sql.includes("count(embedding)"))return {rows:[{total:285,indexed:281}]};
   if(sql.includes('WHERE "id"=ANY'))return {rows:fixture.evidence.map(x=>({id:x.passageId,editionId:x.editionId,contentSha256:x.contentSha256}))};
   if(sql.includes('JOIN "LibraryEdition"')){
    const scope=args[1];
    return {rows:fixture.evidence.filter(x=>!scope||fixture.questions.find(q=>q.id===x.questionId).expectedAuthor===scope)
      .map((x,i)=>({passageId:x.passageId,editionId:x.editionId,author:fixture.questions.find(q=>q.id===x.questionId).expectedAuthor,locator:x.locator,sourceUrl:x.sourceUrl,content:x.excerpt,similarity:0.92-i*0.001})).slice(0,20)};
   }
   throw Error("Unexpected SQL query");
  }};
 let calls=0;
 const ai={embeddings:{async create({input,model}){calls++;assert.equal(input.length,12);assert.equal(model,"text-embedding-3-small");return {data:input.map((_,index)=>({index,embedding:Array(1536).fill(0.002)}))};}}};
 const out=await runHoldoutBenchmark(env,{db,ai,fixtures:fixture});
 assert.equal(calls,1);
 assert.equal(out.questionCount,12);
 assert.equal(out.questions.length,12);
 assert.equal(out.status,"HOLDOUT_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION");
 assert.ok(db.queries.every(x=>/^\s*SELECT\b/.test(x)));
 assert.equal(db.queries.filter(x=>x.includes('JOIN "LibraryEdition"')).length,24);
});
test("rejects production endpoint, changed corpus and altered source before API call",async()=>{
 assert.throws(()=>validateEnvironment({...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"},fixture.questions),/Refusing/);
 const bad={...env,LIBRARY_STAGING_DB_URL:"postgresql://tester:mock@localhost/db"};
 assert.throws(()=>validateEnvironment(bad,fixture.questions),/Refusing/);
 let embeddings=false;
 const db={async connect(){},async end(){},async query(sql){
  if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
  if(sql.includes("count(embedding)"))return {rows:[{total:285,indexed:280}]};
  throw Error("Unexpected SQL");
 }};
 await assert.rejects(runHoldoutBenchmark(env,{db,fixtures:fixture,ai:{embeddings:{async create(){embeddings=true}}}}),/coverage/);
 assert.equal(embeddings,false);
});

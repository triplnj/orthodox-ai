import test from "node:test";
import assert from "node:assert/strict";
import {loadReferenceSets} from "../scripts/patristics/evaluate-30-evidence-staging.mjs";
import {validateContextInputs,inspectContext} from "../scripts/patristics/inspect-30-paragraph-context-staging.mjs";
const fixtures=loadReferenceSets();
const env={LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 LIBRARY_STAGING_DB_URL:"postgresql://tester:mock@ep-test.eu-central-1.aws.neon.tech/neondb"};
function sampleReport(){
 return {status:"PROVISIONAL_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION",branchId:env.LIBRARY_STAGING_BRANCH_ID,
  questionCount:30,total:285,indexed:281,
  questions:fixtures.questions.map(q=>{
   const rank={hit@10:0};
   const empty={baseline:rank,reranked:rank,baselineTop10:[],rerankedTop10:[]};
   return {questionId:q.id,searches:{"all-authors":empty,"expected-author":empty}};
  })};
}
test("input checker rejects altered benchmark, production branch and malformed questions",()=>{
 const r=sampleReport();
 assert.doesNotThrow(()=>validateContextInputs(env,r,fixtures));
 assert.throws(()=>validateContextInputs({...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"},r,fixtures),/Refusing/);
 assert.throws(()=>validateContextInputs(env,{...r,indexed:280},fixtures),/Wrong report/);
 assert.throws(()=>validateContextInputs(env,{...r,questions:[...r.questions.slice(1),r.questions[1]]},fixtures),/mapping mismatch/);
});
test("context inspection uses only SELECTs and preserves original no-hit results",async()=>{
 const report=sampleReport();
 const ids=new Map(fixtures.evidence.map(e=>[e.passageId,e]));
 let queries=[];let connected=false;
 const db={
  async connect(){connected=true},async end(){connected=false},
  async query(sql,args){
   queries.push({sql,args});
   if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
   if(sql.includes('count(embedding)'))return {rows:[{total:285,indexed:281}]};
   if(sql.includes('WITH anchors'))return {rows:[...ids.values()].map(x=>({
    passageId:x.passageId,editionId:x.editionId,locator:x.locator,ordinal:x.ordinal,
    contentSha256:x.contentSha256,content:x.excerpt,speakerName:null,statementKind:null,attributionStatus:"UNREVIEWED"
   }))};
   throw Error("Unexpected SQL");
  }
 };
 const result=await inspectContext(env,report,fixtures,{db});
 assert.equal(result.allQuestions.length,120);
 assert.equal(result.rerankedGlobalMisses.length,30);
 assert.ok(result.allQuestions.every(r=>r.originalHit10===0));
 assert.equal(connected,false);
 assert.ok(queries.every(x=>/^\s*(SELECT|WITH)\b/.test(x.sql)));
});
test("mismatching source hash prevents a misleading report",async()=>{
 const report=sampleReport();
 const db={
  async connect(){},async end(){},
  async query(sql){
   if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
   if(sql.includes('count(embedding)'))return {rows:[{total:285,indexed:281}]};
   if(sql.includes('WITH anchors'))return {rows:fixtures.evidence.map(x=>({
    passageId:x.passageId,editionId:x.editionId,locator:x.locator,contentSha256:"changed"
   }))};
   throw Error("Unexpected SQL");
  }
 };
 await assert.rejects(inspectContext(env,report,fixtures,{db}),/content changed/);
});

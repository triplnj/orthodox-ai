import test from "node:test";
import assert from "node:assert/strict";
import {relevantEvidence,evaluateRankedList,aggregateScores} from "../scripts/patristics/evidence-retrieval-metrics.mjs";
import {loadReferenceSets,validateEnvironment,runEvidenceBenchmark} from "../scripts/patristics/evaluate-30-evidence-staging.mjs";

const fixtures=loadReferenceSets();
const env={
 LIBRARY_STAGING_DB_URL:"postgresql://tester:mock@ep-test.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 OPENAI_API_KEY:"unit-test-only"
};
const vector=Array(1536).fill(0.001);
function mockDb({guard=true,indexed=281,tamper=false}={}){
 const queries=[];
 return {
  queries,async connect(){},async end(){},
  async query(sql,args){
   queries.push({sql,args});
   if(sql.includes('"LibraryStagingGuard"'))
     return {rows:guard?[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]:[]};
   if(sql.includes("count(embedding)"))return {rows:[{total:285,indexed}]};
   if(sql.includes('WHERE "id"=ANY'))return {rows:[
      ...new Map(fixtures.evidence.map(x=>[x.passageId,{
       id:x.passageId,editionId:x.editionId,
       contentSha256:tamper?"invalid":x.contentSha256
      }])).values()
   ]};
   if(sql.includes('JOIN "LibraryEdition"')){
    const author=args[1];
    const pool=fixtures.evidence.filter(x=>!author||
       fixtures.questions.some(q=>q.expectedAuthor===author&&q.editionId===x.editionId));
    return {rows:[...new Map(pool.map((x,i)=>[x.passageId,{
      passageId:x.passageId,author:author??fixtures.questions.find(q=>q.editionId===x.editionId)?.expectedAuthor,
      editionId:x.editionId,locator:x.locator,sourceUrl:x.sourceUrl,
      content:x.excerpt+" Additional surrounding prose for meaningful search ranking.",
      similarity:0.8-i/1000
    }])).values()].slice(0,20)};
   }
   throw Error("Unexpected SQL "+sql);
  }
 };
}
test("retrieval metrics count explicit roles but not objection as accepted doctrine",()=>{
 const evidence=[
  {questionId:"basil-01",passageId:"direct",role:"DIRECT_ANSWER"},
  {questionId:"basil-01",passageId:"context",role:"SUPPORTING_CONTEXT"},
  {questionId:"basil-01",passageId:"objection",role:"OBJECTION_NOT_DOCTRINE"},
  {questionId:"gregory-03",passageId:"opposition",role:"OBJECTION_NOT_DOCTRINE"}
 ];
 const relevant=relevantEvidence("basil-01",evidence);
 assert.equal(relevant.size,2);
 assert.equal(relevant.has("objection"),false);
 assert.equal(relevantEvidence("gregory-03",evidence).has("opposition"),true);
 const x=evaluateRankedList([{passageId:"noise"},{passageId:"direct"},{passageId:"context"}],relevant);
 assert.equal(x["hit@3"],1);
 assert.equal(x["recall@3"],1);
 assert.equal(x["recall@5"],1);
 assert.equal(x.firstRelevantRank,2);
 assert.equal(x.reciprocalRank,0.5);
 assert.ok(x["ndcg@3"]<1);
 assert.throws(()=>evaluateRankedList([{passageId:"dup"},{passageId:"dup"}],relevant),/Repeated/);
 assert.ok(aggregateScores([{baseline:x,reranked:x}],"baseline")["recall@3"]===1);
});
test("30-question fixtures contain positive evidence links",()=>{
 assert.equal(fixtures.questions.length,30);
 assert.equal(fixtures.evidence.length,61);
 assert.ok(fixtures.questions.every(q=>relevantEvidence(q.id,fixtures.evidence).size>0));
});
test("retrieval benchmark is read-only and one bounded batch",async()=>{
 const db=mockDb();let calls=0;
 const ai={embeddings:{async create(args){
  calls++;assert.equal(args.input.length,30);
  assert.equal(args.model,"text-embedding-3-small");
  return {data:args.input.map((_,index)=>({index,embedding:vector}))};
 }}};
 const report=await runEvidenceBenchmark(env,{db,ai,fixtures});
 assert.equal(calls,1);
 assert.equal(report.questions.length,30);
 assert.equal(report.indexed,281);
 assert.ok(report.summary["all-authors"].baseline["hit@10"]>=0);
 assert.ok(db.queries.every(x=>/^\s*SELECT\b/.test(x.sql)));
 assert.equal(db.queries.filter(x=>x.args?.length===2).length,60);
});
test("branch mismatch and changed corpus prevent API calls",async()=>{
 for(const bad of [{guard:false},{indexed:1},{tamper:true}]){
  const db=mockDb(bad);let called=false;
  await assert.rejects(runEvidenceBenchmark(env,{db,fixtures,
   ai:{embeddings:{async create(){called=true;throw Error("should not run")}}}}));
  assert.equal(called,false);
 }
});
test("rejects production branch, local PostgreSQL and excessive query bytes",()=>{
 assert.throws(()=>validateEnvironment({...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"},fixtures.questions),/Refusing/);
 assert.throws(()=>validateEnvironment({...env,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/live"},fixtures.questions),/Refusing/);
 const bad=fixtures.questions.map(q=>({...q,question:"very long question ".repeat(100)}));
 assert.throws(()=>validateEnvironment(env,bad),/budget/);
});

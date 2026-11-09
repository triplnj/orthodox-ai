import test from "node:test";
import assert from "node:assert/strict";
import {indexTwoNewWorks} from "../scripts/patristics/index-two-new-works-staging.mjs";
const env={
 LIBRARY_STAGING_DB_URL:"postgresql://user:mock@ep-test.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 PATRISTIC_NEW_WORKS_INDEX_APPROVAL:"INDEX_TWO_NEW_WORKS_STAGING_ONLY",
 OPENAI_API_KEY:"fake-test"
};
const report={status:"TWO_NEW_WORKS_STAGED_UNREVIEWED",branchId:env.LIBRARY_STAGING_BRANCH_ID,
 counts:{passages:10},editionIds:["edition_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","edition_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]};
const records=[
 {id:report.editionIds[0],importStatus:"STAGED",author:"St. Athanasius of Alexandria",
  title:"On the Incarnation of the Word, Chapter 1",passages:4,embedded:0,bytes:2394,max_bytes:960},
 {id:report.editionIds[1],importStatus:"STAGED",author:"St. Cyril of Jerusalem",
  title:"Catechetical Lecture 1",passages:6,embedded:0,bytes:7719,max_bytes:1450}
];
function mockDb({guard=true,rows=records}={}){
 return {calls:[],async connect(){},async end(){},async query(sql){
  this.calls.push(sql);
  if(sql.includes('"LibraryStagingGuard"'))return {rows:guard?[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]:[]};
  if(sql.includes('FROM "LibraryEdition" e'))return {rows};
  throw Error("Unexpected SQL");
 }};
}
test("indexing is staging-only, limited to two known editions and ten passages",async()=>{
 const db=mockDb();let batches=0;
 const r=await indexTwoNewWorks(report,env,{db,runBatch:async([,, ,n])=>{
  batches++;
  assert.ok(Number(n)<=8);
  return {indexed:Number(n),remaining:0};
 }});
 assert.equal(r.status,"TWO_NEW_WORKS_INDEXED_STAGING_ONLY");
 assert.equal(r.newlyIndexed,10);
 assert.equal(r.maxBudgetUSD,0.05);
 assert.equal(batches,2);
 assert.ok(db.calls.every(s=>/^\s*SELECT\b/.test(s)));
});
test("wrong staging branch and unknown report fail before DB writes",async()=>{
 await assert.rejects(indexTwoNewWorks(report,{...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"}),/approval/);
 await assert.rejects(indexTwoNewWorks({...report,status:"PRODUCTION"},env),/report/);
 await assert.rejects(indexTwoNewWorks(report,{...env,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/postgres"}),/non-Neon/);
});
test("changed source count or wrong author cannot trigger embedding calls",async()=>{
 for(const rows of [
  [{...records[0],passages:5},records[1]],
  [records[0],{...records[1],author:"Another author"}]
 ]){
  let called=false;
  await assert.rejects(indexTwoNewWorks(report,env,{db:mockDb({rows}),runBatch:async()=>{called=true}}));
  assert.equal(called,false);
 }
 await assert.rejects(indexTwoNewWorks(report,env,{db:mockDb({guard:false})}),/guarded/);
});

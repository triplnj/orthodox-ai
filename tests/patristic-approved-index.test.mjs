import test from "node:test";
import assert from "node:assert/strict";
import {indexApprovedBatch} from "../scripts/patristics/index-approved-batch.mjs";

const env={
 LIBRARY_STAGING_DB_URL:"postgresql://tester:fake@ep-sample.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 OPENAI_API_KEY:"test-only-not-real",
 PATRISTIC_INDEX_APPROVAL:"INDEX_101_STAGING_ONLY"
};
function fakeDb({wrongBranch=false,tooLarge=false}={}){
 let edition=0;
 return {
  ended:false,
  async connect(){},
  async end(){this.ended=true;},
  async query(sql){
   if(sql.includes('"LibraryStagingGuard"'))return {rows:[{
      branchId:wrongBranch?"br-wrong":env.LIBRARY_STAGING_BRANCH_ID,
      purpose:"PATRISTIC_LIBRARY_STAGING"}]};
   if(sql.includes('max(octet_length')){
     const count=edition++===0?29:72;
     return {rows:[{status:"STAGED",total:count,embedded:0,
       bytes:tooLarge?"2000000":String(count*1000),max_bytes:1000}]};
   }
   if(sql.includes('count(*)::int AS count'))return {rows:[{count:0}]};
   throw Error("Unexpected query: "+sql);
  }
 };
}
test("indexes only approved edition counts, checking budget first",async()=>{
 const db=fakeDb();
 const calls=[];
 const counts=new Map([
  ["edition_b0cd850e255cf4bd4310094ce8625dec",29],
  ["edition_55ef4de453f96a6f885f78a83e01edc0",72]
 ]);
 const result=await indexApprovedBatch(env,{db,runBatch:async args=>{
   const id=args[1],batch=Number(args[3]),remaining=counts.get(id),n=Math.min(batch,remaining);
   calls.push([id,n]);counts.set(id,remaining-n);
   return {indexed:n,remaining:remaining-n};
 }});
 assert.equal(result.newlyIndexed,101);
 assert.equal(result.expectedPassages,101);
 assert.ok(result.conservativePreflightUSD<1);
 assert.equal(calls.reduce((n,[,b])=>n+b,0),101);
 assert.equal(db.ended,true);
});
test("blocks non-staging guards before requesting embeddings",async()=>{
 let called=false;
 await assert.rejects(indexApprovedBatch(env,{db:fakeDb({wrongBranch:true}),
  runBatch:async()=>{called=true;}}),/Refusing non-staging/);
 assert.equal(called,false);
});
test("blocks overlarge input and missing approval before embedding API",async()=>{
 let called=false;
 await assert.rejects(indexApprovedBatch(env,{db:fakeDb({tooLarge:true}),
  runBatch:async()=>{called=true;}}),/batch size exceeded/);
 await assert.rejects(indexApprovedBatch({...env,PATRISTIC_INDEX_APPROVAL:""},{db:fakeDb(),
  runBatch:async()=>{called=true;}}),/approval gate missing/);
 assert.equal(called,false);
});

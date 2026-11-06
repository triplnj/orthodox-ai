import test from "node:test";
import assert from "node:assert/strict";
import { scan } from "../scripts/patristics/scan-dialogue-staging.mjs";
const BRANCH = "br-spring-frost-assfzje6";
const env={LIBRARY_STAGING_BRANCH_ID:BRANCH,LIBRARY_STAGING_DB_URL:"postgresql://test:fake@ep-test.eu-central-1.aws.neon.tech/neondb?sslmode=require"};

function fakeDb({expectedBranch=BRANCH,passages=175}={}){
  const queries=[];
  const db={
    async connect(){},
    async end(){},
    async query(sql,params){
      queries.push(sql);
      if(sql.includes('"LibraryStagingGuard"')) return {rows:[{branchId:expectedBranch,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
      if(sql.includes('"LibraryEdition"')) return {rows:[{importStatus:"STAGED"}]};
      if(sql.includes('"LibraryPassage"')) return {rows:Array.from({length:passages},(_,i)=>({
        locator:"Source paragraph "+String(i+1).padStart(3,"0"),
        ordinal:0,content:i===83?"But that, said I, was not the point in question.":"A passage discussing resurrection."
      }))};
      throw Error("Unexpected query");
    }
  };
  return {db,queries};
}
test("scan is read only and counts flags without inferring speaker",async()=>{
  const {db,queries}=fakeDb();
  const r=await scan(env,{db});
  assert.equal(r.scannedPassages,175);
  assert.equal(r.flaggedPassages,1);
  assert.equal(r.unflaggedPassages,174);
  assert.equal(r.reviewSamples[0].flags[0].speaker,"UNDETERMINED");
  assert.equal(r.databaseWrites,0);
  assert.ok(queries.every(q=>/^SELECT /i.test(q)));
});
test("branch mismatch fails closed before querying passages",async()=>{
  const {db,queries}=fakeDb({expectedBranch:"br-other-branch"});
  await assert.rejects(scan(env,{db}),/non-staging/);
  assert.equal(queries.length,1);
});
test("incomplete source fails closed",async()=>{
  const {db}=fakeDb({passages:174});
  await assert.rejects(scan(env,{db}),/precisely 175/);
});
test("invalid destination rejected without DB connection",async()=>{
  await assert.rejects(scan({LIBRARY_STAGING_DB_URL:"postgresql://a:b@localhost/test",LIBRARY_STAGING_BRANCH_ID:BRANCH}),/Invalid Neon/);
});

test("review-all includes exact offsets and surrounding context without changing database",async()=>{
  const {db,queries}=fakeDb();
  const result=await scan(env,{db,reviewAll:true});
  assert.equal(result.flaggedPassages,1);
  assert.equal(result.reviewSamples[0].flags[0].evidenceText,"said I");
  assert.ok(result.reviewSamples[0].flags[0].contextBefore.includes("But that"));
  assert.equal(result.reviewSamples[0].flags[0].speaker,"UNDETERMINED");
  assert.equal(result.databaseWrites,0);
  assert.ok(queries.every(q=>/^SELECT /i.test(q)));
});

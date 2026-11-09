import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveAuthorScope} from "../scripts/patristics/resolve-author-scope.mjs";
import {shadowAuthorRouting} from "../scripts/patristics/shadow-author-routing-staging.mjs";
const fixture=JSON.parse(readFileSync("tests/fixtures/patristic-author-router-12-shadow.json","utf8"));
const rows=[
 ["St. Athanasius of Alexandria","author_a",4],
 ["St. Basil the Great","author_b",29],
 ["St. Cyril of Jerusalem","author_c",6],
 ["St. Gregory of Nyssa","author_g1",175],
 ["St. Gregory of Nyssa","author_g2",5],
 ["St. John Chrysostom","author_j",72],
 ["Augustine of Hippo","pilot_augustinus",0]
].map(([canonicalName,id,indexed])=>({canonicalName,id,indexed}));
const env={LIBRARY_STAGING_DB_URL:"postgresql://test:key@ep-test.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6"};
test("all twelve frozen shadow cases have stable expected scopes and author names",()=>{
 assert.equal(fixture.cases.length,12);
 for(const q of fixture.cases){
  const r=resolveAuthorScope(q.question,rows);
  assert.equal(r.scope,q.expectedScope,q.id);
  if(q.expectedAuthor)assert.deepEqual(r.authors,[q.expectedAuthor],q.id);
 }
});
test("shadow execution only issues SELECT and does not request embeddings",async()=>{
 const queries=[];
 const db={async connect(){},async end(){},async query(sql){
  queries.push(sql);
  if(sql.includes('"LibraryStagingGuard"'))
   return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
  if(sql.includes('FROM "LibraryAuthor" a'))return {rows};
  throw Error("Unexpected SQL");
 }};
 const report=await shadowAuthorRouting(env,{db,fixture});
 assert.equal(report.questionCount,12);assert.equal(report.passCount,12);
 assert.equal(report.databaseWrites,0);assert.equal(report.embeddingRequests,0);
 assert.deepEqual(report.duplicateNames,["St. Gregory of Nyssa"]);
 assert.ok(queries.every(x=>/^\s*SELECT\b/.test(x)));
});
test("wrong branch and missing staging guard fail before routing",async()=>{
 await assert.rejects(shadowAuthorRouting({...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"},{fixture}),/Protected staging/);
 await assert.rejects(shadowAuthorRouting(env,{fixture,db:{
  async connect(){},async end(){},async query(){return {rows:[]}}
 }}),/guard mismatch/);
});

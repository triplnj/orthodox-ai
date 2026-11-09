import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runCatalogRouterShadow} from "../scripts/patristics/shadow-catalog-author-routing-staging.mjs";
const fixture=JSON.parse(readFileSync("tests/fixtures/patristic-catalog-author-router-16-shadow.json","utf8"));
const registry=JSON.parse(readFileSync("tests/fixtures/patristic-reviewed-author-aliases-v1.json","utf8"));
const rows=[
 ["St. Athanasius of Alexandria","author_a",4],
 ["St. Basil the Great","author_b",29],
 ["St. Cyril of Jerusalem","author_c",6],
 ["St. Gregory of Nyssa","author_g1",175],
 ["St. Gregory of Nyssa","author_g2",5],
 ["St. John Chrysostom","author_j",72],
 ["Augustine of Hippo","pilot_augustinus",0]
].map(([canonicalName,id,indexed])=>({canonicalName,id,indexed,nameVariants:[]}));
const env={LIBRARY_STAGING_DB_URL:"postgresql://test:key@ep-test.eu-central-1.aws.neon.tech/neondb",LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6"};
test("sixteen frozen cases are resolved against staged catalogue, no writes",async()=>{
 const statements=[];
 const db={async connect(){},async end(){},async query(sql){
  statements.push(sql);
  if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
  if(sql.includes('FROM "LibraryAuthor"'))return {rows};
  throw Error("Unexpected query");
 }};
 const result=await runCatalogRouterShadow(env,{db,fixture,registry});
 assert.equal(result.passCount,16);
 assert.equal(result.databaseWrites,0);
 assert.equal(result.embeddingRequests,0);
 assert.ok(statements.every(x=>/^\s*SELECT\b/.test(x)));
 const gregory=result.results.find(x=>x.id==="gregory-duplicate-group");
 assert.equal(gregory.actualScope,"SINGLE_AUTHOR");
 assert.deepEqual(gregory.authorGroups[0].authorIds,["author_g1","author_g2"]);
});
test("rejects production branch and bad protected marker",async()=>{
 await assert.rejects(runCatalogRouterShadow({...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"},{fixture,registry}),/protected staging/);
 await assert.rejects(runCatalogRouterShadow(env,{fixture,registry,db:{async connect(){},async end(){},async query(){return {rows:[]}}}}),/not verified/);
});

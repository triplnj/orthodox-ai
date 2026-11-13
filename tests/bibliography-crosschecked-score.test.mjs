import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";
const corpus=JSON.parse(fs.readFileSync("docs/qa/crosschecked-author-work-role-corpus.json","utf8"));
const {evaluateCrosscheckedClaims}=createLoader({})("src/lib/patristics/bibliography-crosscheck-score.ts");
test("independent source check contains verified source URL references and explicit caution",()=>{
 assert.equal(corpus.claims.length,9);
 assert.equal(Object.keys(corpus.sourceRegistry).length,9);
 assert.ok(corpus.claims.every(c=>c.sourceIds.length>=2&&c.sourceIds.every(id=>!!corpus.sourceRegistry[id])));
 assert.ok(corpus.claims.some(x=>x.id==="john-fount"&&x.caution.includes("manuscript grouping")));
 assert.equal(corpus.groundTruthLevel,"MULTI_SOURCE_CROSSCHECK_PENDING_INDEPENDENT_REVIEW");
});
test("separate ancient author from modern translator and adaptor",()=>{
 const a=corpus.claims.find(x=>x.id==="athanasius-incarnation");
 const t=corpus.claims.find(x=>x.id==="athanasius-behr");
 const n=corpus.claims.find(x=>x.id==="nicodemos-adapter");
 assert.equal(a.role,"AUTHOR");assert.equal(t.role,"TRANSLATOR");assert.equal(n.role,"ADAPTOR");
 assert.equal(t.relation,"TRANSLATION_OF");
 assert.equal(n.relation,"ADAPTATION_OF");
});
test("crosschecked scoring penalizes false authorship and collection confusion",()=>{
 const accurate=corpus.claims.slice(0,4).map(({author,work,role,relation,parentWork})=>({author,work,role,relation,parentWork}));
 const prediction=[accurate[0],{...accurate[1],role:"EDITOR"},{...accurate[2],relation:"WORK",parentWork:undefined},{author:"Unknown Writer",work:"Lost Tome",role:"AUTHOR",relation:"WORK"}];
 const result=evaluateCrosscheckedClaims(corpus.claims,prediction);
 assert.deepEqual([result.exactSupportedClaims,result.wrongRoles,result.wrongWorkRelationships,result.unsupportedClaims],[1,1,1,1]);
 assert.equal(result.precision,0.25);
 assert.ok(result.recall<0.2);
});
test("perfect score on nine crosschecked records cannot claim 20 author release requirement",()=>{
 const score=evaluateCrosscheckedClaims(corpus.claims,corpus.claims);
 assert.equal(score.precision,1);
 assert.equal(score.recall,1);
 console.log("CROSSCHECKED_BIBLIOGRAPHY_SCORE="+JSON.stringify({
  referenceClaims:corpus.claims.length,sourceRecords:Object.keys(corpus.sourceRegistry).length,
  directModelAnswerPredictions:0,measuredRealChatPrecision:null,
  independentHumanReview:false,requiredAuthorCountMet:false,requiredClaimCountMet:false,
  releaseReady:false
 }));
});

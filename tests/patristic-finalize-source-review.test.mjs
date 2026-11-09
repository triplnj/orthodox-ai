import test from "node:test";
import assert from "node:assert/strict";
import {finalizeStagingSourceReview} from "../scripts/patristics/finalize-staging-source-review.mjs";
function fixture(){
 const results=Array.from({length:297},(_,i)=>({
   passageId:"passage_"+i,editionId:"edition_"+i%9,locator:"Section "+i,
   sourceUrl:"https://www.newadvent.org/fathers/test.htm",hashOk:true,
   full:i<224,status:i<224?"FULL_NORMALIZED_MATCH":i<244?"THREE_ANCHORS_MATCH":"PARTIAL_TEXT_MATCH"
 }));
 return {status:"STAGING_SOURCE_TEXT_AUDIT",branchId:"br-spring-frost-assfzje6",
  total:297,sourceUrls:9,badHashes:0,sourceFailures:[],databaseWrites:0,
  productionChanges:0,results};
}
test("classify source matches without granting quotations or theological authority",()=>{
 const a=finalizeStagingSourceReview(fixture());
 assert.equal(a.summary.fullTextMatch,224);
 assert.equal(a.summary.quarantined,73);
 assert.equal(a.summary.quoteApprovals,0);
 assert.equal(a.summary.releaseApproved,false);
 assert.equal(a.records.filter(x=>x.mayBeRetrievalCandidate).length,224);
 assert.ok(a.records.every(x=>x.mayQuoteDirectly===false&&x.speakerVerified===false));
});
test("no matching source cannot be silently accepted",()=>{
 const x=fixture();x.results[0].full=false;
 assert.throws(()=>finalizeStagingSourceReview(x),/Unexpected source classification counts/);
});
test("stale and corrupted source audits fail closed",()=>{
 const x=fixture();x.sourceFailures=[{url:"https://example.com",error:"timeout"}];
 assert.throws(()=>finalizeStagingSourceReview(x),/Incomplete or unsafe/);
 const y=fixture();y.results[0].passageId=y.results[1].passageId;
 assert.throws(()=>finalizeStagingSourceReview(y),/Missing\/duplicate/);
});

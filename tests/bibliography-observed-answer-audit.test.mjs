import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dataset=JSON.parse(fs.readFileSync("docs/qa/observed-chat-bibliography-audit.json","utf8"));
test("real observed bibliography QA across authors, never fabricated model assertions",()=>{
 assert.equal(dataset.samples.length,2);
 const authors=new Set(dataset.samples.map(s=>s.author));
 assert.equal(authors.size,2);
 assert.ok(dataset.samples.every(s=>s.sampleType==="REAL_ANSWER_NOT_SYNTHETIC"));
 assert.ok(dataset.samples.every(s=>s.records.length===s.claimCount));
 assert.ok(dataset.samples.every(s=>s.records.every(r=>r.issues.length>0)));
 assert.ok(dataset.samples.every(s=>s.reviewerStatus.includes("NOT_INDEPENDENT_HUMAN_REVIEW")));
 const john=dataset.samples.find(s=>s.author==="John of Damascus");
 const basil=dataset.samples.find(s=>s.author==="Basil of Caesarea");
 assert.ok(john.records.some(r=>r.issues.includes("SPECULATIVE_ROLE")));
 assert.ok(john.records.some(r=>r.issues.includes("EDITORIAL_EDITION_TITLE_LISTED_AS_INDEPENDENT_WORK")));
 assert.ok(basil.records.some(r=>r.issues.includes("SOURCE_WORK_MISMATCH")&&r.url.endsWith("3202038.htm")));
 assert.ok(basil.records.some(r=>r.issues.includes("GENERIC_CATEGORY_AS_INDEPENDENT_WORK")));
 const total=dataset.samples.reduce((n,s)=>n+s.records.length,0);
 console.log("OBSERVED_CHAT_ANSWER_AUDIT="+JSON.stringify({
   distinctAuthors:authors.size,actualChatAnswers:dataset.samples.length,
   assessedClaims:total,claimsWithVisibleIssues:dataset.samples.reduce((n,s)=>n+s.records.filter(r=>r.issues.length).length,0),
   independentlyReviewed:false,statisticallyValidAccuracyEstimate:false,releaseReady:false
 }));
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dataset=JSON.parse(fs.readFileSync("docs/qa/observed-chat-bibliography-audit.json","utf8"));
test("observed real preview response is measured separately from synthetic fixture scores",()=>{
 assert.equal(dataset.samples.length,1);
 const sample=dataset.samples[0];
 assert.equal(sample.sampleType,"REAL_ANSWER_NOT_SYNTHETIC");
 assert.equal(sample.records.length,3);
 assert.equal(sample.records.filter(r=>r.issues.length>0).length,3);
 const allIssues=sample.records.flatMap(r=>r.issues);
 assert.ok(allIssues.includes("SPECULATIVE_ROLE"));
 assert.ok(allIssues.includes("EDITORIAL_EDITION_TITLE_LISTED_AS_INDEPENDENT_WORK"));
 assert.ok(allIssues.includes("UNSOURCED_SERBIAN_TITLE_TRANSLATION"));
 assert.equal(sample.reviewerStatus,"ASSISTANT_SCREENED_NOT_INDEPENDENT_HUMAN_REVIEW");
 console.log("OBSERVED_CHAT_ANSWER_AUDIT="+JSON.stringify({
   distinctAuthors:1,actualChatAnswers:1,assessedClaims:3,
   claimsWithVisibleIssues:3,independentlyReviewed:false,
   statisticallyValidAccuracyEstimate:false,releaseReady:false
 }));
});

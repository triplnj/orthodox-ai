import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const v1=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-evidence.json","utf8"));
const v2=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-evidence-v2-review-candidates.json","utf8"));
const qs=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-questions.json","utf8")).questions;
const allowed=new Set(["DIRECT_ANSWER","SUPPORTING_CONTEXT","OBJECTION_NOT_DOCTRINE","DIALOGUE_RESPONSE_BY_GREGORY"]);

test("v2 review is separate from immutable 61-evidence baseline and contains only unapproved candidates",()=>{
 assert.equal(v1.schemaVersion,1);
 assert.equal(v1.evidenceCount,61);
 assert.equal(v2.schemaVersion,2);
 assert.equal(v2.baselineFrozen,true);
 assert.equal(v2.baselineEvidenceCount,61);
 assert.equal(v2.candidateCount,10);
 assert.equal(v2.candidates.length,10);
 assert.ok(v2.candidates.every(x=>x.reviewStatus==="PENDING_INDEPENDENT_EDITORIAL_ADJUDICATION"));
 assert.ok(qs.every(q=>q.reviewStatus==="SOURCE_TEXT_CHECKED_PENDING_EDITORIAL_APPROVAL"));
});
test("proposals have real source IDs, anchors, hashes and never duplicate existing question-evidence links",()=>{
 const existing=new Set(v1.items.map(x=>x.questionId+"|"+x.passageId));
 const proposalKeys=new Set();
 for(const c of v2.candidates){
   assert.ok(allowed.has(c.role));
   assert.match(c.passageId,/^passage_[a-f0-9]+$/);
   assert.match(c.contentSha256,/^[a-f0-9]{64}$/);
   assert.ok(c.sourceUrl.startsWith("https://"));
   assert.ok(c.basis.length>45&&c.caution.length>30);
   const question=qs.find(q=>q.id===c.questionId);
   assert.ok(question&&question.editionId===c.editionId);
   assert.match(c.locator,/^Source paragraph \d{3}$/);
   const key=c.questionId+"|"+c.passageId;
   assert.equal(existing.has(key),false,"Do not silently overwrite v1 evidence");
   assert.equal(proposalKeys.has(key),false,"No duplicate v2 proposal");
   proposalKeys.add(key);
 }
});
test("objections and Gregory's arguments are not reclassified as Macrina's answers",()=>{
 const g2=v2.candidates.filter(x=>x.questionId==="gregory-02");
 const byId=new Map(g2.map(x=>[x.passageId,x]));
 assert.equal(byId.get("passage_0b5f77b22fb16c4dc9a8b8a25b16973d").role,"OBJECTION_NOT_DOCTRINE");
 assert.equal(byId.get("passage_7f0210eb5322a922eff191b5842a004a").role,"DIALOGUE_RESPONSE_BY_GREGORY");
 assert.ok(v2.candidates.every(x=>x.currentAttributionStatus!=="TEXT_VERIFIED"||x.currentSpeakerName));
});

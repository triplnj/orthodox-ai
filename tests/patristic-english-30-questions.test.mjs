import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const data=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-questions.json","utf8"));
const evidence=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-evidence.json","utf8"));
const EXPECTED={
 "St. Basil the Great":"edition_b0cd850e255cf4bd4310094ce8625dec",
 "St. John Chrysostom":"edition_55ef4de453f96a6f885f78a83e01edc0",
 "St. Gregory of Nyssa":"edition_7f982e9d2f0acc26526b91f0042dee75"
};
test("30 English patristic questions are distinct, evenly grouped and source-scoped",()=>{
 const rows=data.questions;
 assert.equal(rows.length,30);
 assert.equal(new Set(rows.map(x=>x.id)).size,30);
 assert.equal(new Set(rows.map(x=>x.question.toLowerCase())).size,30);
 assert.equal(Object.keys(EXPECTED).length,3);
 for(const [author,edition] of Object.entries(EXPECTED)){
   const group=rows.filter(x=>x.expectedAuthor===author);
   assert.equal(group.length,10,author);
   assert.ok(group.every(x=>x.editionId===edition));
 }
 for(const q of rows){
   assert.equal(q.language,"en");
   assert.ok(q.question.length>35&&q.question.endsWith("?"));
   assert.equal(q.reviewStatus,"SOURCE_TEXT_CHECKED_PENDING_EDITORIAL_APPROVAL");
   assert.ok(q.relevantPassageIds.length>=1);
   assert.ok(q.candidateLocators.length>0&&q.candidateLocators.length<=5);
   assert.ok(q.candidateLocators.every(l=>/^Source paragraph \d{3}$/.test(l)));
 }
});
test("candidate locators are not mislabeled as verified doctrine or answer keys",()=>{
 assert.equal(data.mode,"LOBSTER_VERIFIABLE_DEPTH");
 assert.ok(data.questions.every(q=>q.note.includes("Independent theological editorial approval remains pending.")));
 assert.ok(data.questions.every(q=>!Object.hasOwn(q,"verifiedAnswer")));
});

test("all 30 questions have source-checked passage IDs and explicit evidence roles",()=>{
 assert.equal(evidence.questionCount,30);
 assert.equal(evidence.evidenceCount,evidence.items.length);
 assert.equal(evidence.evidenceStatus,"SOURCE_TEXT_CHECKED_PENDING_EDITORIAL_APPROVAL");
 assert.ok(evidence.items.length>=30);
 const allowed=new Set(["DIRECT_ANSWER","SUPPORTING_CONTEXT","OBJECTION_NOT_DOCTRINE","NARRATIVE_OBJECTION_CONTEXT","SPEAKER_CONTEXT","QUESTION_CONTEXT"]);
 for(const q of data.questions){
   const entries=evidence.items.filter(x=>x.questionId===q.id);
   assert.deepEqual(entries.map(x=>x.passageId),q.relevantPassageIds);
   assert.ok(entries.every(x=>x.editionId===q.editionId));
   assert.ok(entries.every(x=>q.candidateLocators.includes(x.locator)));
   for(const item of entries){
     assert.ok(allowed.has(item.role),item.role);
     assert.match(item.passageId,/^passage_[a-f0-9]+$/);
     assert.match(item.contentSha256,/^[a-f0-9]{64}$/);
     assert.ok(item.sourceUrl.startsWith("https://"));
     assert.ok(item.excerpt.length>0);
     assert.equal(item.editorialStatus,"SOURCE_EXCERPT_REVIEWED_NOT_DOCTRINALLY_CERTIFIED");
   }
 }
});
test("dialogue objections are not labeled as direct author teaching",()=>{
 const objectionCases=["gregory-03","gregory-06","gregory-09"];
 for(const id of objectionCases){
   assert.ok(evidence.items.some(x=>x.questionId===id&&x.role==="OBJECTION_NOT_DOCTRINE"));
 }
 assert.ok(data.questions.every(q=>!Object.hasOwn(q,"verifiedAnswer")));
});

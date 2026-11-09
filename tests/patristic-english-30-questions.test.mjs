import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const data=JSON.parse(readFileSync("tests/fixtures/patristic-english-30-questions.json","utf8"));
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
   assert.equal(q.reviewStatus,"PENDING_SOURCE_REVIEW");
   assert.deepEqual(q.relevantPassageIds,[]);
   assert.ok(q.candidateLocators.length>0&&q.candidateLocators.length<=5);
   assert.ok(q.candidateLocators.every(l=>/^Source paragraph \\d{3}$/.test(l)));
 }
});
test("candidate locators are not mislabeled as verified doctrine or answer keys",()=>{
 assert.equal(data.mode,"LOBSTER_VERIFIABLE_DEPTH");
 assert.ok(data.questions.every(q=>q.note.includes("not reviewed ground-truth")));
 assert.ok(data.questions.every(q=>!Object.hasOwn(q,"verifiedAnswer")));
});

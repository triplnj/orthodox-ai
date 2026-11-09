import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const fixture=JSON.parse(readFileSync("tests/fixtures/patristic-new-works-8-question-plan.json","utf8"));
const sources=new Map([
 ["St. Athanasius of Alexandria",{title:"On the Incarnation of the Word, Chapter 1",max:1}],
 ["St. Cyril of Jerusalem",{title:"Catechetical Lecture 1",max:6}]
]);
test("new works are asked as new works without invented staging IDs",()=>{
 assert.equal(fixture.purpose,"CROSS_WORK_QUESTION_PLAN_NOT_YET_EVALUATED");
 assert.equal(fixture.questions.length,8);
 assert.equal(new Set(fixture.questions.map(x=>x.question)).size,8);
 assert.deepEqual(new Set(fixture.questions.map(x=>x.author)),new Set(sources.keys()));
 for(const q of fixture.questions){
  const src=sources.get(q.author);
  assert.equal(q.work,src.title);
  assert.equal(q.language,"en");
  assert.ok(q.question.endsWith("?"));
  assert.equal(q.sourcePassageId,null);
  assert.equal(q.editorialStatus,"QUESTION_SOURCE_SECTION_IDENTIFIED_PENDING_TEXT_AND_CITATION_REVIEW");
  assert.ok(q.locator.startsWith(q.author.includes("Athanasius")?"Chapter I, §":"Catechetical Lecture I, §"));
 }
});

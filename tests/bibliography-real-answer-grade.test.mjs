import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";
const {gradeRealBibliographyAnswer}=createLoader({})("src/lib/patristics/bibliography-real-answer-grade.ts");
const corpus=JSON.parse(fs.readFileSync("docs/qa/crosschecked-author-work-role-corpus.json","utf8"));
const cases=JSON.parse(fs.readFileSync("docs/qa/real-chat-bibliography-structured-claims.json","utf8"));
test("actual captured answer is scored as non-independent without inventing an accuracy percent",()=>{
 assert.equal(cases.samples.length,1);
 const result=gradeRealBibliographyAnswer(corpus.claims,corpus.sourceRegistry,cases.samples[0].claims);
 assert.equal(result.observedClaims,3);
 assert.equal(result.humanReviewedClaims,0);
 assert.equal(result.humanReviewedPrecision,null);
 assert.equal(result.unassessedClaims,3);
 assert.equal(result.rows.filter(r=>r.issues.includes("EDITION_AS_ORIGINAL_WORK")).length,2);
 assert.equal(result.rows.filter(r=>r.issues.includes("SPECULATIVE_AUTHORSHIP")).length,2);
 assert.equal(result.releaseReady,false);
 console.log("REAL_CHAT_BIBLIOGRAPHY_GRADE="+JSON.stringify({
   observedAnswers:cases.samples.length,observedClaims:result.observedClaims,
   editionConfusions:2,speculativeRoles:2,
   independentHumanReviewedClaims:result.humanReviewedClaims,
   measuredPrecision:result.humanReviewedPrecision,releaseReady:false
 }));
});
test("same source work and author with mismatched role and parent work both fail",()=>{
 const truth=corpus.claims.find(x=>x.id==="nicodemos-adapter");
 const score=gradeRealBibliographyAnswer([truth],corpus.sourceRegistry,[{
   author:truth.author,work:truth.work,role:"AUTHOR",relation:"WORK",citedUrls:truth.sourceIds.map(x=>corpus.sourceRegistry[x].url),
   adjudication:"HUMAN_REVIEWED",
 }]);
 assert.equal(score.humanReviewedPrecision,0);
 assert.ok(score.rows[0].issues.includes("WRONG_ROLE"));
 assert.ok(score.rows[0].issues.includes("WRONG_WORK_RELATION"));
});
test("unknown source references remain unresolved even with a correct title",()=>{
 const truth=corpus.claims.find(x=>x.id==="basil-spirit");
 const score=gradeRealBibliographyAnswer([truth],corpus.sourceRegistry,[{
   author:truth.author,work:truth.work,role:truth.role,relation:truth.relation,
   citedUrls:["https://untrusted.example.edu/claim"],adjudication:"HUMAN_REVIEWED",
 }]);
 assert.equal(score.humanReviewedPrecision,0);
 assert.ok(score.rows[0].issues.includes("CITATION_NOT_IN_CROSSCHECKED_RECORD"));
});
test("fully cited and properly attributed human-reviewed claims score correctly",()=>{
 const truth=corpus.claims.find(x=>x.id==="basil-spirit");
 const score=gradeRealBibliographyAnswer([truth],corpus.sourceRegistry,[{
   author:truth.author,work:truth.work,role:truth.role,relation:truth.relation,
   citedUrls:truth.sourceIds.map(id=>corpus.sourceRegistry[id].url),adjudication:"HUMAN_REVIEWED",
 }]);
 assert.equal(score.humanReviewedPrecision,1);
 assert.equal(score.correctHumanReviewedClaims,1);
 assert.equal(score.releaseReady,false);
});

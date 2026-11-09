import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessPassageAttribution as assess} from "../scripts/patristics/assess-passage-attribution.mjs";
const review=JSON.parse(readFileSync("tests/fixtures/patristic-gregory-speaker-evidence-review.json","utf8"));
const trusted=review.reviewedPassages;
const macrinaPassage="Why, what is the special pain you feel, asked the Teacher, in the mere necessity itself of dying? This common talk of unthinking persons is no sufficient accusation.";
function params(passage=macrinaPassage){return {workAuthor:"St. Gregory of Nyssa",passage,sourceLocator:"Source paragraph 003",passageId:"passage_d451a2cb7b4381904cece710504c14ff",contentSha256:"74e821f527733d87d9eeca1f2d529abb198270f1456720b9fe46a62433c23f7a",editionId:"edition_7f982e9d2f0acc26526b91f0042dee75",sourceMatchStatus:"FULL_NORMALIZED_MATCH",reviewRecordId:"gregory-dialogue-macrina-p003-20261109",trustedReviews:trusted};}
test("bibliographic author never automatically becomes speaker",()=>{
 assert.equal(assess({workAuthor:"St. Gregory of Nyssa",passage:macrinaPassage}).attributionAllowed,false);
 assert.equal(assess({workAuthor:"St. Gregory of Nyssa",passage:"I rejoined with sorrow"}).attributionAllowed,false);
});
test("arbitrary review IDs or fake source status cannot unlock attribution",()=>{
 assert.equal(assess({workAuthor:"St. Gregory of Nyssa",passage:macrinaPassage,reviewedSpeaker:"St. Macrina",sourceLocator:"Source paragraph 003",reviewRecordId:"review-gregory-018"}).attributionAllowed,false);
 assert.equal(assess({...params(),contentSha256:"000",reviewedSpeaker:"St. Macrina"}).attributionAllowed,false);
 assert.equal(assess({...params(),sourceMatchStatus:"PARTIAL_TEXT_MATCH"}).attributionAllowed,false);
 assert.equal(assess({...params(),passage:"altered "+macrinaPassage}).attributionAllowed,false);
 assert.equal(assess({...params(),passageId:"different"}).attributionAllowed,false);
 assert.equal(assess({...params(),editionId:"different"}).attributionAllowed,false);
 assert.equal(assess({...params(),sourceLocator:"different"}).attributionAllowed,false);
 assert.equal(assess({...params(),reviewedSpeaker:"St. Gregory of Nyssa"}).attributionAllowed,false);
});
test("source-matched and fingerprinted Macrina speech is independently attributed, not publication-approved",()=>{
 const r=assess({...params(),reviewedSpeaker:"St. Macrina"});
 assert.equal(r.attributionAllowed,true);assert.equal(r.speaker,"St. Macrina");
 assert.equal(r.mayQuoteDirectly,false);
});
test("source author and passage must be populated",()=>{
 assert.throws(()=>assess({workAuthor:"",passage:"Test"}),/required/);
 assert.throws(()=>assess({workAuthor:"St. Gregory of Nyssa",passage:""}),/required/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reviewIsolatedPreviewAnswer as review, previewQuestionLanguage} from "../scripts/patristics/review-isolated-preview-answer.mjs";
const opening="But when we were in each other's presence the sight of the Teacher awakened all my pain; for she too was lying in a state of prostration even unto death. Well, she gave in to me for a little while, like a skilful driver, in the ungovernable violence of my grief; and then she tried to check me by speaking, and to correct with the curb of her reasonings the disorder of my soul.";
const apostolic="She quoted the Apostle's words about the duty of not being grieved for them that sleep; because only men without hope have such feelings.";
const sampleAnswer="In the dialogue On the Soul and the Resurrection, after the death of Basil, Gregory of Nyssa seeks out his sister Macrina, called the Teacher, to share his grief. Macrina, though herself deeply sorrowful and weakened, gently guides Gregory by encouraging him to bring his intense sorrow under the control of reason. She reminds him of the Apostle’s teaching that Christians should not grieve as those without hope do, because the faithful have the hope of resurrection and eternal life. Through her calm and reasoned words, Macrina helps Gregory begin to transform his overwhelming grief into a more hopeful and measured mourning rooted in Christian faith.";
const src=(excerpt)=>({authorName:"St. Gregory of Nyssa",workTitle:"On the Soul and the Resurrection",verificationStatus:"STAGING_TEXT_MATCH_ONLY",metadata:{sourceTextMatch:true,speakerVerified:false,exactQuoteAllowed:false,excerpt}});
const sources=[src(opening),src(apostolic)];
test("recorded authentic Preview answer passes structural gate (not semantic certification)",()=>{
 assert.deepEqual(review(sampleAnswer,sources),{accepted:true,issues:[]});
});
test("a fabricated universal salvation claim is denied",()=>{
 const r=review("Macrina teaches apokatastasis and universal salvation.",sources);
 assert.equal(r.accepted,false);assert.ok(r.issues.includes("UNSUPPORTED_HIGH_RISK_CLAIM"));
});
test("fabricated PG/PL references are denied",()=>{
 assert.ok(review("See PG 46, 125 for the exact passage.",sources).issues.includes("UNVERIFIED_PATROLOGIA_REFERENCE"));
 assert.ok(review("See PL 32:1.",sources).issues.includes("UNVERIFIED_PATROLOGIA_REFERENCE"));
});
test("copied 12+ word source excerpt is rejected even without quotation marks",()=>{
 const r=review("Well, she gave in to me for a little while, like a skilful driver, in the ungovernable violence of my grief.",sources);
 assert.ok(r.issues.includes("UNAPPROVED_VERBATIM_SOURCE_COPY"));
});
test("an unreviewed source, bad status, or forged Macrina speaker cannot authorize an answer",()=>{
 for(const altered of [
  {...sources[0],verificationStatus:"VERIFIED"},
  {...sources[0],authorName:"St. Macrina"},
  {...sources[0],metadata:{...sources[0].metadata,speakerVerified:true}},
  {...sources[0],metadata:{...sources[0].metadata,exactQuoteAllowed:true}},
  {...sources[0],metadata:{...sources[0].metadata,sourceTextMatch:false}}
 ]){
  const r=review(sampleAnswer,[altered,sources[1]]);
  assert.ok(r.issues.includes("SOURCE_NOT_PILOT_VERIFIED"));
 }
});
test("no evidence or empty answer cannot pass the pilot",()=>{
 assert.ok(review("A plausible theological answer",[]).issues.includes("INVALID_EVIDENCE_COUNT"));
 assert.ok(review("",sources).issues.includes("EMPTY_ANSWER"));
});
test("Preview pilot buffers answer generation until validation, production keeps streaming",()=>{
 const s=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.match(s,/onDelta: protectedPilotAnswer \? undefined : onDelta/);
 assert.match(s,/reviewIsolatedPreviewAnswer\(result\.answer,research\?\.sources \?\? \[\]\)/);
 assert.ok(s.indexOf("reviewIsolatedPreviewAnswer(result.answer")<s.indexOf("onDelta?.(result.answer)"));
});

test("observed bilingual English + Serbian response is denied",()=>{
 const bilingual=sampleAnswer+"\n\nПосле смрти Василија, Григорије Ниски је тражио утеху код Макрине која му је помогла да разумно обузда тугу.";
 const r=review(bilingual,sources,"en");
 assert.equal(r.accepted,false);
 assert.ok(r.issues.includes("WRONG_OR_MIXED_ANSWER_LANGUAGE"));
});
test("duplicated Cyrillic paragraphs are denied even when the script is correct",()=>{
 const paragraph="Макрина је утешила Григорија након Василијеве смрти разумним речима, подсећајући га на апостолско учење о нади, и тако му помогла да обузда дубоку жалост. Она је остала његова учитељица у тренутку тешке туге.";
 const r=review(paragraph+"\n\n"+paragraph,sources,"sr-Cyrl");
 assert.equal(r.accepted,false);assert.ok(r.issues.includes("DUPLICATED_ANSWER_TEXT"));
});
test("Preview language selection preserves the user's Serbian script",()=>{
 assert.equal(previewQuestionLanguage("How does Macrina help Gregory of Nyssa?"),"en");
 assert.equal(previewQuestionLanguage("Kako je Makrina utešila Grigorija Niskog?"),"sr-Latn");
 assert.equal(previewQuestionLanguage("Како је Макрина утешила Григорија Ниског?"),"sr-Cyrl");
});

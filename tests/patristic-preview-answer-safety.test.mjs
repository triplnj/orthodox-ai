import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reviewIsolatedPreviewAnswer as review, previewQuestionLanguage,normalizePreviewAnswerText} from "../scripts/patristics/review-isolated-preview-answer.mjs";
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
 assert.match(s,/reviewIsolatedPreviewAnswer\(result\.answer,research\?\.sources \?\? \[\],pilotLanguage\)/);
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

test("1 Thessalonians 4:13 does not ban ordinary grief: reject observed overstatements",()=>{
 const misleading=[
  "Macrina says grief is not fitting for those who have hope.",
  "The Apostle teaches the duty not to grieve for those who sleep.",
  "For Christians, sorrow is unbefitting for those who have hope.",
  "Apostolske reči zabranjuju da se tuguje za pokojnicima.",
  "Макрина учи да не треба жалити оне који су уснули.",
  "Grief belongs only to those who lack hope."
 ];
 for(const answer of misleading){
  const r=review(answer,sources);
  assert.equal(r.accepted,false,answer);
  assert.ok(r.issues.includes("MISREADS_APOSTOLIC_MOURNING_WITH_HOPE"),answer);
 }
});
test("natural mourning is permitted when joined to Christian hope",()=>{
 const accurate="Macrina consoles Gregory in his grief over Basil's death. She does not prohibit sorrow; by recalling the Apostle's words she distinguishes grieving with Christian hope from despairing as those without hope.";
 const r=review(accurate,sources);
 assert.equal(r.accepted,true);
});

test("reject observed Serbian Cyrillic grief/mourning mistranslations",()=>{
 for(const text of [
   "Макрина је рекла да се не тужи као они без наде.",
   "Након Василијеве смрти, Макрина, названа Учитељица, тешила је Григорија."
 ]){
  const r=review(text,sources);
  assert.ok(r.issues.includes("SERBIAN_GRIEF_TRANSLATION_ERROR"),text);
 }
});
test("permit idiomatic Serbian wording",()=>{
 const answer="Након смрти Василија, Макрина, називана Учитељицом, утешила је Григорија и помогла му да тугује не губећи хришћанску наду. Она није одбацила природну жалост, већ га је подсетила да се жалост верујућих разликује од безнађа.";
 assert.equal(review(answer,sources).accepted,true);
});

test("narrow Serbian repair preserves theology while removing erroneous title/verb",()=>{
 const raw="Након смрти Василија, Григорије је отишао код сестре Макрине, названа Учитељица, да пронађе утеху. Макрина је рекла да се не тужи као они без наде, већ да тужна душа може да тугује са надом.";
 const fixed=normalizePreviewAnswerText(raw,"sr-Cyrl");
 assert.doesNotMatch(fixed,/названа Учитељица|не тужи као/);
 assert.match(fixed,/Макрине, да пронађе утеху/);
 assert.match(fixed,/не тугује као они без наде/);
 assert.equal(normalizePreviewAnswerText(raw,"en"),raw);
 assert.equal(normalizePreviewAnswerText(raw,"sr-Latn"),raw);
 assert.equal(review(fixed,sources).accepted,true);
});

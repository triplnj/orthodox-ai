import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyGregoryOpeningQuestion as classify} from "../scripts/patristics/classify-gregory-opening-question.mjs";

const cases=[
 ["recorded-preview-answer-question","How does Macrina help Gregory of Nyssa overcome his grief after Basil’s death?",true,"BASIL_MACRINA_OPENING_GRIEF"],
 ["basil-mourning","How does Gregory of Nyssa describe mourning after the death of Basil?",true,"BASIL_MACRINA_OPENING_GRIEF"],
 ["consolation","How does Macrina comfort Gregory of Nyssa after Basil's death?",true,"BASIL_MACRINA_OPENING_GRIEF"],
 ["serbian-latin","Kako je Makrina utešila Grigorija Niskog posle smrti Vasilija?",true,"BASIL_MACRINA_OPENING_GRIEF"],
 ["serbian-cyrillic","Како је Макрина утешила Григорија Ниског после Василијеве смрти?",true,"BASIL_MACRINA_OPENING_GRIEF"],
 ["soul-doctrine","What does Gregory of Nyssa teach about the immortality of the soul?",false,"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS"],
 ["apokatastasis","What does Gregory of Nyssa teach about apokatastasis and Macrina's grief?",false,"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS"],
 ["immortality-serbian","Шта Григорије Ниски учи о бесмртности душе?",false,"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS"],
 ["generic-soul","What does Gregory of Nyssa teach about the soul?",false,"BEYOND_VERIFIED_OPENING_DIALOGUE"],
 ["unrelated-work","What does Gregory of Nyssa teach about the Trinity?",false,"BEYOND_VERIFIED_OPENING_DIALOGUE"],
 ["two-authors","Compare Gregory of Nyssa and Basil on the grief after Basil's death.",false,"COMPARATIVE_SCOPE_UNSUPPORTED"],
 ["exact-quote","Give the exact words Gregory of Nyssa used to console Macrina after Basil's death.",false,"DIRECT_QUOTATION_NOT_APPROVED"],
 ["exact-quote-cyrillic","Цитирај дословно Григорија Ниског о Макрини и жалости због Василија.",false,"DIRECT_QUOTATION_NOT_APPROVED"],
 ["not-gregory","How does Macrina comfort Augustine after Basil's death?",false,"NOT_NAMED_GREGORY"],
 ["fabricated-source","What does Gregory of Nyssa teach about quantum immortality?",false,"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS"],
];
for(const [id,question,eligible,reason] of cases){
 test("pilot scope "+id,()=>{
  const result=classify(question);
  assert.equal(result.eligible,eligible,question);
  assert.equal(result.reason,reason,question);
 });
}
test("unsupported named Gregory question cannot silently fall back or generate unsupported answer",()=>{
 const pilot=readFileSync("src/lib/patristics/preview-gregory-research.ts","utf8");
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.match(pilot,/const coverage=classifyGregoryOpeningQuestion\(currentMessage\)/);
 assert.match(pilot,/sources:\[\],providersAttempted:\["PROTECTED_STAGING_GREGORY"\]/);
 assert.match(route,/research\?\.providersAttempted\.includes\("PROTECTED_STAGING_GREGORY"\)/);
 assert.match(route,/evidenceRequired && !research\?\.sources\.length/);
});
test("all six Gregory source candidates must have matching passage hashes",()=>{
 const pilot=readFileSync("src/lib/patristics/preview-gregory-research.ts","utf8");
 assert.match(pilot,/expected\.get\(r\.passageId\)===r\.contentSha256/);
 assert.match(pilot,/safe\.length!==6/);
 assert.match(pilot,/exactQuoteAllowed:false/);
 assert.match(pilot,/speakerVerified:false/);
});

test("an approved previous grief question must never approve a new immortality claim",()=>{
 const prev="How does Macrina console Gregory of Nyssa after Basil's death?";
 const current="What does Gregory of Nyssa teach about the immortality of the soul?";
 assert.equal(classify(current).eligible,false);
 assert.equal(classify(current).reason,"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS");
 const source=readFileSync("src/lib/patristics/preview-gregory-research.ts","utf8");
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.match(source,/classifyGregoryOpeningQuestion\(currentMessage\)/);
 assert.match(route,/buildIsolatedGregoryResearch\(query, process\.env, message\)/);
 const qa=readFileSync("src/app/api/patristics/preview-readiness/route.ts","utf8");
 assert.match(qa,/unsupportedSoulQuestionRejected/);
 assert.match(qa,/buildIsolatedGregoryResearch\(composite,process\.env,unsupported\)/);
 assert.equal(classify(prev).eligible,true);
});

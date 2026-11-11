import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";
const loader=createLoader({"server-only":{}});
const {reviewedGregoryOpeningEligible,reviewedGregoryOpeningEvidence}=loader("src/lib/patristics/reviewed-gregory-evidence.ts");
const {reviewedGregoryAnswerIssues}=loader("src/lib/patristics/reviewed-gregory-answer.ts");
const valid=[
 "How does Macrina console Gregory of Nyssa after Basil's death?",
 "Како је Макрина утешила Григорија Ниског после Василијеве смрти?",
 "Kako je Makrina utešila Grigorija Niskog posle smrti Vasilija?"
];
test("reviewed source anchor has exactly 3 linked public primary text excerpts",()=>{
 for(const question of valid){
  assert.equal(reviewedGregoryOpeningEligible(question),true);
  const r=reviewedGregoryOpeningEvidence(question);
  assert.equal(r.sources.length,3);
  assert.equal(r.providersSucceeded[0],"REVIEWED_PRIMARY_TEXT");
  assert.ok(r.sources.every(s=>s.sourceUrl==="https://www.newadvent.org/fathers/2915.htm"
    &&s.verificationStatus==="REVIEWED_PRIMARY_TEXT_TRANSLATION"
    &&s.metadata.reviewedPilot&&s.metadata.speakerVerified===false
    &&s.metadata.exactQuoteAllowed===false&&s.metadata.excerpt.length>100));
  assert.match(r.context,/grieve with Christian hope/);
 }
});
test("no carryover to unreviewed immortality, quote, comparison or generic topics",()=>{
 for(const q of [
  "What does Gregory of Nyssa teach about the immortality of the soul?",
  "What does Gregory of Nyssa teach about the soul?",
  "Give the exact words of Gregory of Nyssa after Basil's death.",
  "Compare Gregory of Nyssa with Basil on grief after Basil's death.",
  "What does St. Maximus Confessor teach about grief?",
  "How did Macrina console her brother?",
  "Како Григорије Ниски учи о бесмртности душе и жалости после Василијеве смрти?",
  "What does Gregory of Nyssa teach about apokatastasis after Basil's death?"
 ]){
  assert.equal(reviewedGregoryOpeningEligible(q),false,q);
  assert.equal(reviewedGregoryOpeningEvidence(q),null,q);
 }
});
test("guard approves a source-grounded summary while rejecting extrapolations and false metaphors",()=>{
 const s=reviewedGregoryOpeningEvidence(valid[0]).sources;
 const supported="Macrina shared Gregory's sorrow over Basil's death. She let him express his grief, then guided him gently towards the Apostle's teaching that Christians do not mourn as people without hope. Her consolation did not reject natural sadness but placed mourning in the light of faith and hope.";
 assert.deepEqual(reviewedGregoryAnswerIssues(supported,s,valid[0]),[]);
 assert.ok(reviewedGregoryAnswerIssues(supported+" She was riding a wild horse.",s,valid[0]).includes("INVENTED_METAPHOR"));
 assert.ok(reviewedGregoryAnswerIssues(supported+" This proves apokatastasis.",s,valid[0]).includes("UNSUPPORTED_DOCTRINAL_CLAIM"));
 assert.ok(reviewedGregoryAnswerIssues(supported,s.slice(0,0),valid[0]).includes("SOURCE_PROVENANCE_NOT_REVIEWED"));
});
test("source gate applies only to current question before streaming, no legacy call regression",()=>{
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 const search=readFileSync("src/lib/patristics/build-patristic-research-context.ts","utf8");
 assert.match(route,/buildPatristicResearchContext\(query, \(\) => onPhase\?\.\("Waiting for distant source\.\.\."\), message\)/);
 assert.match(search,/reviewedGregoryOpeningEvidence\(currentQuestion\)/);
 assert.match(route,/onDelta: reviewedPilot \? undefined : onDelta/);
 assert.match(route,/issues = reviewedGregoryAnswerIssues\(regenerated.answer, research.sources, message\)/);
 assert.ok(route.indexOf("if (reviewedPilot && research)") < route.indexOf('onPhase?.("Reviewing source evidence...")'));
 assert.match(route,/onDelta\?\.\(result.answer\)/);
});

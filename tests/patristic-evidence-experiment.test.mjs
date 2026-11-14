import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLoader } from "./helpers/load-ts.mjs";

const excerpt = "The divine and human wills are natural wills. There is no gnomic deliberation in Christ, because his humanity never deliberates in ignorance.";
const source = { provider:"CURATED_TEXT", authorName:"St Maximus", workTitle:"A relevant disputation",
  reference:null, originalLanguage:"English", sourceUrl:"https://example.org/primary",
  scanUrl:null, verificationStatus:"PRIMARY_TRANSLATION", metadata:{excerpt} };

function reviewer(reply) {
 const calls=[];
 const load=createLoader({
  "@/lib/ai/openaiClient":{getOpenAI:()=>({chat:{completions:{create:async params=>{
    calls.push(params);return {choices:[{message:{content:JSON.stringify(reply)}}]};
  }}}})},
 });
 return {run:load("src/lib/patristics/review-answer-evidence.ts").reviewPatristicAnswerEvidence,calls};
}
test("a link without a verifiable passage cannot be treated as doctrinal evidence",async()=>{
 const {run,calls}=reviewer({assertions:[]});
 const result=await run("What are Christ's wills?","Christ has a gnomic will.",[{...source,metadata:{}}]);
 assert.equal(result.status,"unavailable");
 assert.equal(calls.length,0);
});
test("the reviewer can flag a counterexample using the authentic excerpt, not a stored theological answer",async()=>{
 const answer="Christ has two wills: natural and gnomic.";
 const assertion=answer;
 const {run,calls}=reviewer({assertions:[{assertion,verdict:"contradicted",sourceIndex:0,evidenceQuote:excerpt}]});
 const result=await run("What did the Father teach?",answer,[source]);
 assert.equal(result.status,"reviewed");
 assert.equal(result.assertions[0].verdict,"contradicted");
 assert.equal(result.assertions[0].evidenceQuote,excerpt);
 assert.match(JSON.stringify(calls[0].messages),/gnomic deliberation/);
});
test("fabricated evidence quote never receives a verdict",async()=>{
 const answer="Christ has two wills: natural and gnomic.";
 const {run}=reviewer({assertions:[{assertion:answer,verdict:"supported",sourceIndex:0,evidenceQuote:"The imaginary passage explicitly approves gnomic willing."}]});
 const result=await run("What did the Father teach?",answer,[source]);
 assert.equal(result.status,"unavailable");
});
test("unknown or truncated reviewer data is not reported as verified",async()=>{
 const {run}=reviewer({assertions:[]});
 const result=await run("Question?","Long answer with two independent theological claims.",[source]);
 assert.equal(result.status,"unavailable");
});
test("general patristic research invokes the detailed source-and-claim research method",()=>{
 const research=readFileSync("src/lib/patristics/web-patristic-research.ts","utf8");
 assert.match(research,/content: bibliography \? BIBLIOGRAPHY_RESEARCH_SYSTEM_PROMPT : RESEARCH_SYSTEM_PROMPT/);
 assert.match(research,/CLAIM-EVIDENCE LEDGER:/);
});
test("experiment does not modify the production streamed-answer path",()=>{
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.doesNotMatch(route,/reviewPatristicAnswerEvidence/);
 assert.match(route,/onDelta: reviewedPilot \? undefined : onDelta/);
});

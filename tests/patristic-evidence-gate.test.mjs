import test from "node:test";
import assert from "node:assert/strict";
import {createLoader} from "./helpers/load-ts.mjs";

const {gatePatristicAnswer}=createLoader({})("src/lib/chat/evidence-gate.ts");
const good={claim:"Saint John counsels parents to teach children patience.",status:"excerpt_matched",sourceIndex:0,evidenceQuote:"The father must teach the child the virtue of patience."};
const bad={claim:"All fathers should use only harsh punishment.",status:"needs_review",sourceIndex:null,evidenceQuote:null};
const draft=[good.claim,bad.claim,"If you want, I can provide further quotes."].join("\n\n");

test("a completed audit releases only claims that have source evidence",()=>{
 const screened=gatePatristicAnswer(draft,{status:"completed",claims:[good,bad]},"en");
 assert.equal(screened,good.claim);
 assert.ok(!screened.includes("harsh punishment"));
 assert.ok(!screened.includes("If you want"));
});
test("an unavailable audit never permits the unscreened theological draft",()=>{
 const screened=gatePatristicAnswer(draft,{status:"unavailable",claims:[]},"en");
 assert.ok(!screened.includes("All fathers"));
 assert.match(screened,/could not substantiate/);
});
test("a semantically unsupported answer is not shown merely because sources exist",()=>{
 const screened=gatePatristicAnswer(draft,{status:"completed",claims:[bad]},"en");
 assert.match(screened,/could not substantiate/);
});
test("the gate cannot be bypassed by quoting a claim absent from the draft",()=>{
 const screened=gatePatristicAnswer(draft,{status:"completed",claims:[{...good,claim:"Different claim"}]},"en");
 assert.match(screened,/could not substantiate/);
});

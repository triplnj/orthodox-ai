import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLoader } from "./helpers/load-ts.mjs";

const source=fs.readFileSync("src/lib/patristics/universal-bibliography-resolver.ts","utf8");
const report=fs.readFileSync("docs/qa/bibliography-step6-release-decision.md","utf8");

const {resolveUniversalBibliography}=createLoader({
  "@/lib/ai/openaiClient":{getOpenAI:()=>{throw Error("no external LLM in release audit");}},
  "@/lib/diagnostics":{diagnostic:()=>{},failureCategory:()=> "unexpected"},
  "./fetch-source":{fetchSourceText:()=>{throw Error("no external network in release audit");}},
})("src/lib/patristics/universal-bibliography-resolver.ts");

const subject="Saint Basil the Great",work="On the Holy Spirit";
const query="List the works of Saint Basil the Great";
const url="https://bibliography.example.edu/basil";
const quote=subject+" is the author of "+work+" in this documented edition of Christian theological writings.";
const page={url,title:"Source catalogue",text:quote+" Details of the theological treatise in the historical editions and their sources. ".repeat(4)};
const claims=(role,quoteOverride=quote)=>({claims:[{work,role,relation:"INDEPENDENT",parentWork:null,sourceUrl:url,evidenceQuote:quoteOverride,note:"Provisional model proposal, not a human-reviewed historical attribution."}]});
const call=async extracted=>resolveUniversalBibliography(query,{context:"Discovery",sources:[{sourceUrl:url,title:page.title}]},
 {fetchText:async()=>page,extract:async()=>extracted});

test("P0: source matching alone still permits a wrong claimed author-role (release blocker)",async()=>{
  const r=await call(claims("TRANSLATOR"));
  assert.equal(r.sources[0]?.metadata.roles?.[0],"TRANSLATOR");
  // Characterization is deliberately strict: this records the ongoing
  // safety defect; it does not count as a corrected attribution.
});
test("P0: a textual mention can masquerade as authorship (release blocker)",async()=>{
  const mentioned="A bibliographer reviewed the book On the Holy Spirit, but supplied no author attribution in this passage.";
  const r=await call(claims("AUTHOR",mentioned));
  assert.equal(r.sources.length,0); // quote is not part of the fetched page
  const mentionedPage={...page,text:mentioned+" Other information about editions and bibliographies. ".repeat(5)};
  const rechecked=await resolveUniversalBibliography(query,{context:"Discovery",sources:[{sourceUrl:url,title:"Source catalogue"}]},
    {fetchText:async()=>mentionedPage,extract:async()=>claims("AUTHOR",mentioned)});
  assert.equal(rechecked.sources[0]?.metadata.roles?.[0],"AUTHOR");
});
test("release decision names all blocking deficiencies and prohibits production promotion",()=>{
 for (const term of ["**Decision: NO GO","BIB-P0-01","BIB-P0-02","BIB-P0-03","Real-preview answer-level accuracy benchmark","NOT RUN","Semantic author-role entailment check","MISSING","**NO GO**","PR #61 remains Draft"]) {
   assert.ok(report.includes(term),term);
 }
 assert.match(source,/normalize\(page\.text\)\.includes\(normalize\(x\.evidenceQuote\)\)/);
 assert.match(source,/!ROLES\.has\(x\.role as Role\)/);
 console.log("STEP6_RELEASE_GATE="+JSON.stringify({
   verdict:"NO_GO",releaseReady:false,
   criticalBlockingDefects:3,otherTrackedDefects:2,
   realAnswerBenchmark:"NOT_RUN",semanticEntailmentCheck:"MISSING",
   changeScope:"draft PR #61 only",
 }));
});

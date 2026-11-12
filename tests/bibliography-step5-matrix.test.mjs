import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

/**
 * Step 5/6: cross-author, offline, reproducible bibliography QA.
 * These are synthetic FIXTURES, not evidence of historical accuracy.
 * Characterization gaps are reported separately; CI green != release ready.
 */
const { resolveUniversalBibliography, isUniversalBibliographyQuestion } = createLoader({
  "@/lib/ai/openaiClient": { getOpenAI: () => { throw new Error("Offline matrix must not use OpenAI"); } },
  "@/lib/diagnostics": { diagnostic: () => {}, failureCategory: () => "unexpected" },
  "./fetch-source": { fetchSourceText: async () => { throw new Error("Offline matrix must not reach the web"); } },
})("src/lib/patristics/universal-bibliography-resolver.ts");

const roster = [
  { id:"maximus", author:"Saint Maximus the Confessor", work:"Ambigua", role:"AUTHOR",
    question:"List the works of Saint Maximus the Confessor" },
  { id:"basil", author:"Saint Basil the Great", work:"On the Holy Spirit", role:"AUTHOR",
    question:"List the works of Saint Basil the Great" },
  { id:"gregory", author:"Saint Gregory of Nyssa", work:"On the Soul and the Resurrection", role:"AUTHOR",
    question:"List the works of Saint Gregory of Nyssa" },
  { id:"isaac", author:"Saint Isaac the Syrian", work:"Ascetical Homilies", role:"AUTHOR",
    question:"List the works of Saint Isaac the Syrian" },
  { id:"justin", author:"Saint Justin Popovich", work:"Dogmatics of the Orthodox Church", role:"AUTHOR",
    question:"List the works of Saint Justin Popovich" },
  { id:"nikodemos", author:"Saint Nicodemus the Hagiorite", work:"Unseen Warfare", role:"ADAPTOR",
    question:"List the works of Saint Nicodemus the Hagiorite" },
  { id:"john", author:"Saint John of Damascus", work:"The Dialectica", role:"AUTHOR",
    question:"List the works of Saint John of Damascus" },
];
const url = id => "https://bibliography.example.edu/edition/" + id;
const makePage = spec => {
  const evidence = spec.quote ?? (spec.author + " is identified as " +
    (spec.role === "ADAPTOR" ? "adaptor" : "author") + " of " + spec.work +
    " in the printed bibliographic catalogue of authenticated texts.");
  return { url:url(spec.id), title:"University bibliography: " + spec.author,
    text:[evidence, "Editorial metadata is supplied for comparison with critical editions.",
      "The digital text is a documentary research witness, not an invented quotation.",
      "Authorship classifications must be checked against the bibliographic statement.",
      "The edition catalogue preserves the title and the name of the credited person."].join(" "),
    evidence };
};
const claim = (spec,page,overrides={}) => ({
  work:spec.work,role:spec.role,relation:"INDEPENDENT",parentWork:null,
  sourceUrl:page.url,evidenceQuote:page.evidence,
  note:"Attributed by the example bibliography, pending critical verification.",...overrides,
});
const run = async (spec, options={}) => {
  const page=options.page ?? makePage(spec);
  return resolveUniversalBibliography(spec.question,
    {context:"Discovery candidates only",sources:[{sourceUrl:page.url,title:page.title}]},
    {fetchText: async()=>page,extract:async()=>({claims: options.claims ?? [claim(spec,page)]})},
    options.curated ?? []);
};

const counters={passed:0,failed:0};
for(const spec of roster) {
  test("cross-author accepted source/role: "+spec.id,async()=>{
    const result=await run(spec);
    assert.equal(result.sources.length,1);
    assert.equal(result.sources[0].workTitle,spec.work);
    assert.deepEqual(result.sources[0].metadata.roles,[spec.role]);
    assert.equal(result.sources[0].verificationStatus,"LIVE_BIBLIOGRAPHY_EXCERPT_MATCH");
    counters.passed++;
  });
}
test("partial evidence: preserves a curated edition but never claims original author",async()=>{
  const spec=roster[3];
  const curated=[{authorName:spec.author,workTitle:"A Syriac source collection",sourceUrl:"https://syri.ac/isaac",
    sourceName:"Scholarly catalogue",verificationStatus:"CURATED_SCHOLARLY_BIBLIOGRAPHY"}];
  const result=await run(spec,{claims:[],curated});
  assert.deepEqual(result.sources.map(x=>x.metadata.roles),[["UNKNOWN"]]);
  assert.match(result.context,/LIMITED BIBLIOGRAPHIC RESULT/);
  counters.passed++;
});
test("adaptor cannot be silently upgraded to author in output evidence metadata",async()=>{
  const spec=roster[5];const result=await run(spec);
  assert.equal(result.sources[0].metadata.roles[0],"ADAPTOR");
  assert.doesNotMatch(result.context,/ROLE: AUTHOR/);
  counters.passed++;
});
test("independent parts of a collection preserve the parent-work identity",async()=>{
  const spec=roster[6];
  const page=makePage({...spec,quote:"The Dialectica is part of the Fount of Knowledge, written by Saint John of Damascus."});
  const result=await run(spec,{page,claims:[claim(spec,page,{relation:"PART_OF",parentWork:"Fount of Knowledge"})]});
  assert.equal(result.sources[0].metadata.relation,"PART_OF");
  assert.equal(result.sources[0].metadata.parentWorkTitle,"Fount of Knowledge");
  counters.passed++;
});
test("fabricated parent title is rejected",async()=>{
  const spec=roster[6],page=makePage(spec);
  const result=await run(spec,{page,claims:[claim(spec,page,{relation:"PART_OF",parentWork:"Invented Anthology"})]});
  assert.equal(result.sources.length,0);counters.passed++;
});
test("fabricated quote is rejected even when other metadata looks plausible",async()=>{
  const spec=roster[2],page=makePage(spec);
  const result=await run(spec,{page,claims:[claim(spec,page,{evidenceQuote:"This fabricated source passage never occurs in the actual scholarly bibliography."})]});
  assert.equal(result.sources.length,0);counters.passed++;
});
test("fake URL and unsecure HTTP are not accepted",async()=>{
  const spec=roster[1],page=makePage(spec);
  for(const bad of ["http://bibliography.example.edu/edition/basil","https://wrong.example.edu/basil"]) {
    const r=await run(spec,{page,claims:[claim(spec,page,{sourceUrl:bad})]});
    assert.equal(r.sources.length,0,bad);
  }counters.passed++;
});
test("duplicates from one source are deduplicated",async()=>{
  const spec=roster[0],page=makePage(spec);
  const result=await run(spec,{page,claims:[claim(spec,page),claim(spec,page)]});
  assert.equal(result.sources.length,1);counters.passed++;
});
test("missing search results are reported honestly rather than fabricated",async()=>{
  const spec=roster[4];
  const result=await resolveUniversalBibliography(spec.question,null,
    {fetchText:async()=>{throw Error("No network");},extract:async()=>({claims:[]})});
  assert.equal(result.sources.length,0);assert.match(result.context,/Do not guess/);counters.passed++;
});
test("bibliography intent does not route unrelated doctrinal prompts",()=>{
  assert.equal(isUniversalBibliographyQuestion("What does Saint Gregory teach about the resurrection?"),false);
  assert.equal(isUniversalBibliographyQuestion("Наведи дела Јустина Поповића"),true);
  counters.passed++;
});

/**
 * Known gaps are explicit expected-risk characterization checks, NOT passing
 * correctness tests: the current validator matches text, not semantic truth.
 * Distinct release gates below remain unfulfilled until end-to-end evaluation.
 */
test("CHARACTERIZATION ONLY: a wrong author role can pass a verbatim-quote check",async()=>{
  const spec=roster[1],page=makePage(spec);
  const result=await run(spec,{page,claims:[claim(spec,page,{role:"TRANSLATOR"})]});
  assert.equal(result.sources[0]?.metadata.roles[0],"TRANSLATOR");
  console.log("KNOWN_GAP: quote matching does not prove role semantics.");
});
test("CHARACTERIZATION ONLY: a work mentioned by another author can pass source-text matching",async()=>{
  const spec=roster[0];
  const page=makePage({...spec,quote:"A modern bibliographer wrote a review of Ambigua without providing original authorship documentation."});
  const result=await run(spec,{page,claims:[claim(spec,page)]});
  assert.equal(result.sources.length,1);
  console.log("KNOWN_GAP: mention of work is not proof of author/work attribution.");
});
test("MATRIX SUMMARY: all deterministic assertions run across seven authors",()=>{
  assert.equal(roster.length,7);
  assert.equal(counters.passed,16);
  console.log("STEP5_MATRIX="+JSON.stringify({fixtureAuthors:roster.length,verifiedAssertions:counters.passed,
    knownSemanticGaps:2,liveRetrievalTests:0,liveAnswerTests:0,releaseReady:false}));
});

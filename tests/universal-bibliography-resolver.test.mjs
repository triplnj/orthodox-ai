import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const { isUniversalBibliographyQuestion, resolveUniversalBibliography } = createLoader({
  "@/lib/ai/openaiClient": { getOpenAI: () => { throw Error("network forbidden"); } },
  "./fetch-source": { fetchSourceText: async () => { throw Error("network forbidden"); } },
})("src/lib/patristics/universal-bibliography-resolver.ts");
const page = {
 url: "https://university.example.edu/john-damascene",
 title: "University press — John of Damascus works",
 text: [
  "John of Damascus composed The Fount of Knowledge, comprising three major parts.",
  "The Dialectica is the first part of The Fount of Knowledge.",
  "On Heresies is the second part of The Fount of Knowledge.",
  "An Exact Exposition of the Orthodox Faith is the third part of The Fount of Knowledge.",
  "The Apologetic Treatises against the Holy Images were written by John of Damascus.",
 ].join(" "),
};
const urls = { context: "Discovery only; no verified authorship.", sources: [{ sourceUrl: page.url, title: page.title }] };
const c = (work, quote, relation="PART_OF", parentWork="The Fount of Knowledge",role="AUTHOR") => ({
 work, role, relation, parentWork, sourceUrl: page.url, evidenceQuote: quote,
 note: "The source describes the work and its position in the collection.",
});
const candidates = {claims:[
 c("The Dialectica","The Dialectica is the first part of The Fount of Knowledge."),
 c("On Heresies","On Heresies is the second part of The Fount of Knowledge.","PART_OF","The Fount of Knowledge","COMPILER"),
 c("An Exact Exposition of the Orthodox Faith","An Exact Exposition of the Orthodox Faith is the third part of The Fount of Knowledge."),
]};
const input="Наведи најпознатија дела светог Јована Дамаскина. За свако дело назначи да ли је он његов оригинални аутор, састављач или приређивач и наведи проверљив библиографски извор.";
test("universal gate identifies named-author bibliography without overriding theological queries",()=>{
 assert.equal(isUniversalBibliographyQuestion(input),true);
 assert.equal(isUniversalBibliographyQuestion("List the works of Saint Basil the Great"),true);
 assert.equal(isUniversalBibliographyQuestion("What does Saint Basil say about grace?"),false);
 assert.equal(isUniversalBibliographyQuestion("Наведи дела Јустина Поповића"),true);
 assert.equal(isUniversalBibliographyQuestion("List works by John of Damascus"),true);
 assert.equal(isUniversalBibliographyQuestion("Tell me a story about clouds"),false);
});
test("John of Damascus shows three parts under one parent work, never three standalone books", async()=>{
 const r=await resolveUniversalBibliography(input,urls,{fetchText:async()=>page,extract:async()=>candidates});
 assert.equal(r.sources.length,3);
 assert.ok(r.sources.every(x=>x.metadata.relation==="PART_OF"&&x.metadata.parentWorkTitle==="The Fount of Knowledge"));
 assert.match(r.context,/PART_OF requires explaining/);
 assert.match(r.context,/The Dialectica is the first part/);
 assert.equal(r.providersSucceeded[0],"UNIVERSAL_BIBLIOGRAPHY");
 assert.ok(r.sources.every(x=>x.verificationStatus==="LIVE_BIBLIOGRAPHY_EXCERPT_MATCH"));
});
test("rejects invented quotations, bogus source URLs, extra author attribution and duplicated entries", async()=>{
 const raw={claims:[
  {...candidates.claims[0], evidenceQuote:"An invented claim that no source confirms and is far too confidently asserted here."},
  {...candidates.claims[0], sourceUrl:"https://untrusted.example/claims"},
  {...candidates.claims[0], sourceUrl:"http://university.example.edu/john-damascene"},
  {...candidates.claims[0], work:"Invented Book"},
  candidates.claims[0], candidates.claims[0],
 ]};
 const r=await resolveUniversalBibliography(input,urls,{fetchText:async()=>page,extract:async()=>raw});
 assert.equal(r.sources.length,1);
});
test("invented parent collection cannot be asserted from an unrelated excerpt", async()=>{
 const claim={...candidates.claims[0], parentWork:"Imaginary Collection of Texts"};
 const r=await resolveUniversalBibliography(input,urls,{fetchText:async()=>page,extract:async()=>({claims:[claim]})});
 assert.equal(r.sources.length,0);
});
test("missing parent, empty corpus, and failed model extraction fail closed",async()=>{
 const invalid={claims:[{...candidates.claims[0], parentWork:null}]};
 for (const extract of [async()=>invalid,async()=>{throw Error("model offline");}]){
  const r=await resolveUniversalBibliography(input,urls,{fetchText:async()=>page,extract});
  assert.equal(r.sources.length,0);
  assert.match(r.context,/Do not guess/);
 }
 const empty=await resolveUniversalBibliography(input,null,{fetchText:async()=>page,extract:async()=>candidates});
 assert.equal(empty.sources.length,0);
});
test("same generic engine works for unrelated author without per-saint tables",async()=>{
 const basil={
  url:"https://press.example.edu/basil", title:"Critical edition — Saint Basil", text:
   "Saint Basil the Great wrote On the Holy Spirit as a theological treatise on the Spirit and Christian worship. This study of the Holy Spirit is discussed in multiple scholarly editions of Basil\u0027s theological writings. The treatise considers the Christian liturgical confession of the Spirit alongside the Father and the Son."
 };
 const r=await resolveUniversalBibliography("List works by Saint Basil the Great",
  {context:"Web search",sources:[{sourceUrl:basil.url,title:basil.title}]},
  {fetchText:async()=>basil,extract:async()=>({claims:[{
   work:"On the Holy Spirit",role:"AUTHOR",relation:"INDEPENDENT",parentWork:null,
   sourceUrl:basil.url,evidenceQuote:basil.text,note:"Source explicitly credits Saint Basil with this work."
  }]})});
 assert.equal(r.sources.length,1);
 assert.match(r.context,/On the Holy Spirit/);
});

test("curated work identities yield a safe partial bibliography instead of the generic refusal", async()=>{
 const witness=[{
  authorName:"St. John of Damascus",workTitle:"St John Damascene on Holy Images",
  sourceUrl:"https://www.gutenberg.org/cache/epub/49917/pg49917-images.html",
  sourceName:"Project Gutenberg",verificationStatus:"CURATED_PUBLIC_DOMAIN_EDITION",
 }];
 const r=await resolveUniversalBibliography(input,null,
   {fetchText:async()=>page,extract:async()=>({claims:[]})},witness);
 assert.equal(r.sources.length,1);
 assert.deepEqual(r.sources[0].metadata.roles,["UNKNOWN"]);
 assert.equal(r.sources[0].verificationStatus,"CURATED_BIBLIOGRAPHIC_IDENTITY_ONLY");
 assert.match(r.context,/NEVER infer that listed translations/);
 assert.doesNotMatch(r.context,/AUTHOR: St. John of Damascus is original author/);
});

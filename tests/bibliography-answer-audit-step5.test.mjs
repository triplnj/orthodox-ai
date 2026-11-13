import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";

const seed=JSON.parse(readFileSync(new URL("../src/lib/patristics/bibliography-catalog-seed.json",import.meta.url),"utf8"));
const {sourceBackedBibliographyContext:research}=createLoader({
  "./bibliography-catalog-seed.json":seed,
})("src/lib/patristics/source-backed-bibliography.ts");

const positive=[
  ["Наведи дела светог Никодима Светогорца","St. Nicodemus the Hagiorite"],
  ["Које књиге је приредио Никодим Агиорит?","St. Nicodemus the Hagiorite"],
  ["List the works of St. Nicodemus the Hagiorite","St. Nicodemus the Hagiorite"],
  ["Nabroj dela Nikodima Agiorita","St. Nicodemus the Hagiorite"],
  ["List works by St. Macarius of Corinth","St. Macarius of Corinth"],
  ["List writings of Lorenzo Scupoli","Lorenzo Scupoli"],
  ["Наведи дела Агапија Леонардоса","Agapios Leonardos"],
];
test("step 5 language and author-routing evaluation matrix",()=>{
 for (const [question,expected] of positive){
  const r=research(question);
  assert.ok(r,`No catalog evidence for ${question}`);
  assert.match(r.context,new RegExp(`Requested person: ${expected.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`));
  assert.ok(r.sources.length>0);
 }
});
test("every emitted bibliography source has a reviewed evidence edge matching the exact work and role",()=>{
 for(const [question] of positive){
  const r=research(question);
  for(const source of r.sources){
   const record=seed.evidence.find(e=>e.url===source.sourceUrl &&
     e.workId===source.metadata.workId && e.authorId===seed.authors.find(a=>a.canonicalName===source.authorName)?.id);
   assert.ok(record,`Missing evidence for ${source.workTitle} / ${source.authorName}`);
   assert.equal(record.reviewStatus,"REVIEWED");
   assert.notEqual(record.kind,"COMMUNITY_REFERENCE");
   assert.ok(source.metadata.roles.every(role=>record.rolesSupported.includes(role)));
   assert.equal(source.verificationStatus,"REVIEWED_BIBLIOGRAPHIC_ATTRIBUTION");
  }
 }
});
test("Nicodemus has selective attested roles; unreviewed titles are not released",()=>{
 const r=research("Наведи дела светог Никодима Светогорца");
 const works=new Map(r.sources.map(s=>[s.metadata.workId,s.metadata.roles]));
 assert.deepEqual(works.get("philokalia"),["EDITOR"]);
 assert.deepEqual(works.get("unseen-warfare"),["ADAPTOR"]);
 assert.deepEqual(works.get("pedalion"),["EDITOR"]);
 assert.deepEqual(works.get("paul-fourteen-epistles"),["TRANSLATOR"]);
 assert.equal(works.has("manual-confession"),false);
 assert.equal(works.has("new-synaxarion"),false);
 assert.match(r.context,/SELECTED, NOT EXHAUSTIVE/);
 assert.match(r.context,/There are 2 additional provisional\/disputed attribution/);
 assert.match(r.context,/St. Macarius of Corinth \(COMPILER\)/);
 assert.match(r.context,/Agapios Leonardos \(CO_AUTHOR\)/);
 assert.match(r.context,/Lorenzo Scupoli \(SOURCE_AUTHOR\)/);
});
test("known noncatalog, multi-author and unrelated theological questions do not get catalog-only evidence",()=>{
 const negative=[
  "Наведи дела светог Јустина Поповића",
  "Ко је написао Невидљиву борбу?",
  "List works by St. Nicodemus the Hagiorite and St. Macarius of Corinth",
  "Шта Никодим Светогорац учи о молитви?",
  "What did St. Macarius of Corinth teach about Holy Communion?",
  "Tell me a story",
  "Who authored the Philokalia?",
 ];
 for(const question of negative)assert.equal(research(question),null,question);
});
test("bibliography adapter is not a verified-claim or quotation provider",()=>{
 const r=research("List the works of St. Nicodemus the Hagiorite");
 assert.ok(r.sources.every(s=>!s.metadata?.excerpt));
 assert.doesNotMatch(r.context,/\bPG\s*\d+/);
 assert.match(r.context,/no direct quotation, doctrinal interpretation, or invented page references/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";

const m=createLoader({})("src/lib/patristics/bibliography-catalog.ts");
const filename=new URL("../src/lib/patristics/bibliography-catalog-seed.json",import.meta.url);
const fixture=()=>JSON.parse(readFileSync(filename,"utf8"));
test("seed catalog validates a source-backed, finite, editorially qualified graph",()=>{
 const cat=m.validateBibliographyCatalog(fixture());
 assert.equal(cat.schemaVersion,1);
 assert.equal(cat.authors.length,4);
 assert.equal(cat.works.length,12);
 assert.equal(cat.contributions.length,15);
 assert.equal(cat.evidence.length,18);
 assert.equal(cat.authors[0].completeness,"SELECTED");
 assert.ok(cat.evidence.every(e=>e.url.startsWith("https://")&&e.supportingStatement.length>=25));
 assert.equal(cat.contributions.filter(c=>c.attribution==="REVIEW_REQUIRED").length,2);
});
test("resolve aliases, transliterations and inflected Serbian without per-author code branches",()=>{
 const cat=m.validateBibliographyCatalog(fixture());
 for(const query of [
  "Наведи дела светог Никодима Светогорца",
  "Наведи дела Никодима Агиорита",
  "List the works of Nicodemus the Hagiorite",
  "List works by Saint Nicodemos of the Holy Mountain"
 ]){
  const r=m.findCatalogAuthor(query,cat);
  assert.equal(r.status,"EXACT_AUTHOR",query);
  assert.equal(r.author.id,"nicodemus-hagiorite");
  assert.equal(r.workContributions.length,12);
 }
 assert.equal(m.findCatalogAuthor("What did St Gregory of Nyssa say?",cat).status,"AUTHOR_NOT_FOUND");
});
test("every classified work keeps exact role and source evidence; anthology not sole authorship",()=>{
 const cat=m.validateBibliographyCatalog(fixture());
 const rows=m.listCatalogWorks(cat,"nicodemus-hagiorite");
 assert.equal(rows.length,12);
 const phil=rows.find(x=>x.work.id==="philokalia");
 assert.deepEqual(Array.from(phil.roles),["EDITOR"]);
 assert.equal(phil.work.workKind,"ANTHOLOGY");
 assert.equal(phil.evidence.length,1);
 const warfare=rows.find(x=>x.work.id==="unseen-warfare");
 assert.deepEqual(Array.from(warfare.roles),["ADAPTOR"]);
 assert.equal(warfare.work.workKind,"ADAPTATION");
 const confession=rows.find(x=>x.work.id==="manual-confession");
 assert.equal(confession.status,"REVIEW_REQUIRED");
 assert.equal(confession.evidence[0].reviewStatus,"PENDING_REVIEW");
 assert.equal(rows.some(r=>r.work.id==="pedalion"&&r.roles.includes("EDITOR")),true);
});
test("reject unattributed titles, duplicate author IDs and unreviewed positive claims",()=>{
 const missing=fixture(); missing.contributions[0].evidenceIds=[];
 assert.throws(()=>m.validateBibliographyCatalog(missing),/positive attribution requires/);
 const pending=fixture();pending.evidence[0].reviewStatus="PENDING_REVIEW";pending.evidence[0].reviewedBy=null;pending.evidence[0].reviewedAt=null;
 assert.throws(()=>m.validateBibliographyCatalog(pending),/positive attribution requires/);
 const wrong=fixture();wrong.contributions[0].evidenceIds=["antioch-pedalion"];
 assert.throws(()=>m.validateBibliographyCatalog(wrong),/evidence does not support contribution/);
 const dup=fixture();dup.works.push({...dup.works[0]});
 assert.throws(()=>m.validateBibliographyCatalog(dup),/duplicate id/);
 const unsafe=fixture();unsafe.evidence[0].url="http://localhost:5432/admin";
 assert.throws(()=>m.validateBibliographyCatalog(unsafe),/evidence fields/);
});
test("unknown and ambiguous author queries never silently pick one author",()=>{
 const cat=fixture();
 cat.authors.push({id:"another-author",canonicalName:"Another Patristic Author",
  nameVariants:["The Hagiorite"],completeness:"UNKNOWN"});
 m.validateBibliographyCatalog(cat);
 assert.equal(m.findCatalogAuthor("Works of Saint Nicodemus the Hagiorite",cat).status,"EXACT_AUTHOR");
 const collision=fixture();
 collision.authors.push({id:"another-author",canonicalName:"Another Patristic Author",
  nameVariants:["Nicodemus the Hagiorite"],completeness:"UNKNOWN"});
 m.validateBibliographyCatalog(collision);
 assert.equal(m.findCatalogAuthor("Nicodemus the Hagiorite",collision).status,"AMBIGUOUS_AUTHOR");
});

test("cross-author work relations distinguish compiler, source author, adapter and editor",()=>{
 const c=m.validateBibliographyCatalog(fixture());
 const mac=m.listCatalogWorks(c,"macarius-corinth");
 assert.equal(mac.length,1);
 assert.equal(mac[0].work.id,"philokalia");
 assert.deepEqual(Array.from(mac[0].roles),["COMPILER"]);
 const aga=m.listCatalogWorks(c,"agapios-leonardos");
 assert.equal(aga.length,1);
 assert.equal(aga[0].work.id,"pedalion");
 assert.deepEqual(Array.from(aga[0].roles),["CO_AUTHOR"]);
 const scup=m.listCatalogWorks(c,"lorenzo-scupoli");
 assert.equal(scup.length,1);
 assert.equal(scup[0].work.id,"unseen-warfare");
 assert.deepEqual(Array.from(scup[0].roles),["SOURCE_AUTHOR"]);
 assert.ok(!scup[0].roles.includes("AUTHOR"));
 const nic=m.listCatalogWorks(c,"nicodemus-hagiorite");
 const adapted=nic.find(x=>x.work.id==="unseen-warfare");
 assert.deepEqual(Array.from(adapted.roles),["ADAPTOR"]);
 assert.equal(adapted.evidence.length,2);
});
test("review matrix exposes provisional and confirmed source relations without silently promoting either",()=>{
 const c=m.validateBibliographyCatalog(fixture());
 const rows=m.attributionReviewMatrix(c);
 assert.equal(rows.length,c.contributions.length);
 const provisional=rows.filter(r=>r.status==="REVIEW_REQUIRED");
 assert.equal(provisional.length,2);
 assert.ok(provisional.every(r=>r.openQuestions.includes("ROLE_NEEDS_REVIEW")));
 assert.ok(rows.filter(r=>r.status==="SOURCE_ATTESTED").every(r=>r.verifiedEvidenceIds.length>=1));
 const copy=fixture();
 const under=copy.contributions.find(r=>r.workId==="manual-confession");
 under.attribution="DISPUTED";
 const reviewed=m.attributionReviewMatrix(copy);
 assert.ok(reviewed.find(r=>r.workId==="manual-confession").openQuestions.includes("CONFLICTING_ATTRIBUTION"));
});
test("reject coauthor sources wrongly reused as another author's evidence",()=>{
 const copy=fixture();
 const mac=copy.contributions.find(r=>r.authorId==="macarius-corinth");
 mac.evidenceIds=["antioch-philokalia"];
 assert.throws(()=>m.validateBibliographyCatalog(copy),/evidence does not support contribution/);
});

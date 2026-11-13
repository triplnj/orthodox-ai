import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";
import { readFileSync } from "node:fs";
const {enforceVerbatimPatristicQuotes}=createLoader({})("src/lib/chat/verbatim-patristic-quote-guard.ts");
const source=(author,excerpt)=>({provider:"CURATED_TEXT",authorName:author,workTitle:"Source work",
 sourceUrl:"https://example.org/passage",verificationStatus:"CURATED_PATRISTIC_TEXT_REPOSITORY",
 metadata:{excerpt}});
test("a fabricated direct Chrysostom quotation cannot survive, but a sourced interpretation does",()=>{
 const text="Златоусти учи родитеље да читају Писмо.\nРодитељи су „детоубице и гори од детоубица“.\nДуховно васпитање је важно.";
 const r=enforceVerbatimPatristicQuotes(text,[source("John Chrysostom","Hearken ye, as many as are worldly, and have the charge of wife and children;")]);
 assert.equal(r.removed,1);assert.doesNotMatch(r.answer,/детоубице/);assert.match(r.answer,/Духовно васпитање/);assert.match(r.answer,/изостављени/);
});
test("verbatim quotation retained only when exact source excerpt supplied",()=>{
 const q="St Basil wrote “The Spirit is not a creature of God” in the treatise.";
 const r=enforceVerbatimPatristicQuotes(q,[source("Basil the Great","The Spirit is not a creature of God in this setting.")]);
 assert.equal(r.removed,0);assert.equal(r.retained,1);assert.equal(r.answer,q);
});
test("unverified Serbian translation cannot masquerade as an exact English quotation",()=>{
 const q="Свети Максим каже „Бог је створио сва видљива бића“.\nОстали проверени подаци.";
 const r=enforceVerbatimPatristicQuotes(q,[source("Maximus the Confessor","God created all visible beings")]);
 assert.equal(r.removed,1);assert.doesNotMatch(r.answer,/Бог је створио/);
});
test("does not use editorial bibliography summaries as primary passage evidence",()=>{
 const q='Ignatius said “Seven letters of the middle recension are generally genuine”.';
 const src=source("Ignatius of Antioch","Seven letters of the middle recension are generally genuine");
 src.metadata.bibliographyCatalog=true;src.metadata.supportingStatement="Seven letters of the middle recension are generally genuine";
 const r=enforceVerbatimPatristicQuotes(q,[src]);
 assert.equal(r.removed,1);
});
test("does not eliminate book titles or short technical terminology in quotation marks",()=>{
 const q="Свети Григорије Ниски написао је „О души и васкрсењу“. Писао је о „слободној вољи“.";
 const r=enforceVerbatimPatristicQuotes(q,[]);
 assert.equal(r.answer,q);
});
test("multiple quoted sentences on a line require every quote to be supported",()=>{
 const src=source("Isaac the Syrian","Pray without ceasing for all.");
 const q='“Pray without ceasing for all” but “The invisible sun burns in darkness”.';
 assert.equal(enforceVerbatimPatristicQuotes(q,[src]).removed,1);
});
test("guard runs before SSE final delta, claim audit, database persistence, and normal nonpatristic streaming remains",()=>{
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.match(route,/onDelta: reviewedPilot \|\| evidenceRequired \? undefined : onDelta/);
 const guard=route.indexOf("const guarded = enforceVerbatimPatristicQuotes");
 const emit=route.indexOf("onDelta?.(result.answer);",guard);
 const audit=route.indexOf("const claimAudit =",guard);
 const save=route.indexOf("await completeTurn(",guard);
 assert.ok(guard>0&&emit>guard&&audit>emit&&save>audit);
});

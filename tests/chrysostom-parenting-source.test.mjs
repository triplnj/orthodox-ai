import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { createLoader } from "./helpers/load-ts.mjs";
const {findCuratedPatristicDocuments}=createLoader({})("src/lib/patristics/curated-text-sources.ts");
const key="chrysostom-vainglory-how-to-bring-up-children";
for (const question of [
 "Шта учи свети Јован Златоусти о улози родитеља у васпитању деце?",
 "Шта Јован Златоусти саветује о кажњавању деце?",
 "What did John Chrysostom teach about raising children?"
]) {
 test("primary parenting text is retrievable for "+question,()=>{
   const hits=findCuratedPatristicDocuments(question);
   assert.ok(hits.some(x=>x.key===key));
   assert.equal(hits[0].key,key);
 });
}
test("unrelated named Fathers cannot borrow Chrysostom's parenting work",()=>{
 const hits=findCuratedPatristicDocuments("Шта свети Максим Исповедник каже о васпитању деце?");
 assert.ok(!hits.some(x=>x.key===key));
});
test("ordinary Scripture questions keep the already indexed Colossians homily",()=>{
 const hits=findCuratedPatristicDocuments("Шта Јован Златоусти каже о читању Светог Писма?");
 assert.ok(hits.some(x=>x.key==="chrysostom-colossians-homily-9"));
});

test("parenting primary text contributes extractable excerpts and remains first in limited result set", async () => {
 const accessed = [];
 const load = createLoader({
  "@/lib/diagnostics": {diagnostic:()=>{},failureCategory:()=>"network"},
  "./fetch-source": {fetchSourceText:async url=>{
   accessed.push(url);
   if (url.includes("Rightway.pdf")) return {text:"A father and mother must care for their children, and teach the child sound education and virtue. ".repeat(85)};
   return {text:"The reading of Scriptures is important for parents and children. ".repeat(80)};
  }},
  "./search-wikisource-collection":{searchWikisourceCollection:async()=>[]}
 });
 const {searchCuratedPatristicTexts}=load("src/lib/patristics/search-curated-texts.ts");
 const hits=await searchCuratedPatristicTexts("Шта учи свети Јован Златоусти о улози родитеља у васпитању деце?",5);
 assert.ok(accessed.some(x=>x.endsWith("/Rightway.pdf")),"primary PDF retrieval was attempted");
 assert.ok(hits.length>0,"source text produced evidence");
 assert.equal(hits[0].workTitle,"Address on Vainglory and How to Bring Up Children");
 assert.ok(hits[0].excerpt.includes("father and mother"));
 assert.ok(hits.some(item=>item.workTitle==="Homily 21 on Ephesians"),"directly relevant Ephesians homily stays available");
});

test("parenting source list excludes same-author homilies unrelated to parenting",()=>{
 const hits=findCuratedPatristicDocuments("Шта свети Јован Златоусти учи о улози родитеља у васпитању деце?");
 const keys=hits.map(x=>x.key);
 assert.ok(keys.includes("chrysostom-vainglory-how-to-bring-up-children"));
 assert.ok(keys.includes("chrysostom-ephesians-homily-21"));
 assert.ok(!keys.includes("chrysostom-lazarus-discourse-3"));
 assert.ok(!keys.includes("chrysostom-colossians-homily-9"));
});
test("unknown subject retains author-only fallback rather than blocking answers",()=>{
 const hits=findCuratedPatristicDocuments("Ко је свети Јован Златоусти?");
 assert.ok(hits.some(x=>x.key==="chrysostom-colossians-homily-9"));
});
test("relevant primary works suppress generic web-source cards, not the normal chat response",()=>{
 const context=readFileSync("src/lib/patristics/build-patristic-research-context.ts","utf8");
 assert.match(context,/directPrimaryCoverage/);
 assert.match(context,/webResearch\?\.context && !directPrimaryCoverage/);
 const chat=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.doesNotMatch(chat,/gatePatristicAnswer/);
 assert.match(chat,/onDelta: reviewedPilot \? undefined : onDelta/);
});

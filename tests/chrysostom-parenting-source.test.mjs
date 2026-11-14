import test from "node:test";
import assert from "node:assert/strict";
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
 assert.ok(hits.some(item=>item.workTitle==="Homily 9 on Colossians"),"other approved homilies stay available");
});

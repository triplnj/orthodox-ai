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

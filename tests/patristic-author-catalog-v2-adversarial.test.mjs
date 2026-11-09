import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveAuthorCatalogV2} from "../scripts/patristics/resolve-author-catalog-v2.mjs";
const cases=JSON.parse(readFileSync("tests/fixtures/patristic-author-catalog-v2-adversarial.json","utf8")).cases;
const names=[
 ["St. Athanasius of Alexandria","a",4,["Athanasius of Alexandria"]],
 ["St. Basil the Great","b",29,["Basil the Great","Василије Велики","Свети Василије Велики"]],
 ["St. Cyril of Jerusalem","c",6,["Cyril of Jerusalem"]],
 ["St. Gregory of Nyssa","g1",175,["Gregory of Nyssa","Gregorius Nyssenus"]],
 ["St. Gregory of Nyssa","g2",5,["Gregory of Nyssa","Gregorius Nyssenus"]],
 ["St. John Chrysostom","j",72,["John Chrysostom"]],
 ["Augustine of Hippo","aug",0,[]]
].map(([canonicalName,id,indexed,nameVariants])=>({canonicalName,id,indexed,nameVariants}));
test("nineteen difficult author routing regression cases",()=>{
 assert.equal(cases.length,19);
 for(const c of cases){
  const result=resolveAuthorCatalogV2(c.question,names);
  assert.equal(result.scope,c.expectedScope,c.id+": "+result.reason);
 }
});

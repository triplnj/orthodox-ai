import test from "node:test";
import assert from "node:assert/strict";
import {resolveAuthorCatalogV2 as resolve} from "../scripts/patristics/resolve-author-catalog-v2.mjs";
const rows=[
 {id:"b",canonicalName:"St. Basil the Great",indexed:14,nameVariants:["Basil the Great","Свети Василије Велики","светог Василија Великог"]},
 {id:"g1",canonicalName:"St. Gregory of Nyssa",indexed:175,nameVariants:["Gregory of Nyssa","Свети Григорије Ниски"]},
 {id:"g2",canonicalName:"St. Gregory of Nyssa",indexed:5,nameVariants:["Gregory of Nyssa"]},
 {id:"m",canonicalName:"St. Maximus the Confessor",indexed:0,nameVariants:["Maximus the Confessor"]},
 {id:"c",canonicalName:"St. Cyril of Jerusalem",indexed:9,nameVariants:["Cyril of Jerusalem"]},
 {id:"x",canonicalName:"St. Cyril of Alexandria",indexed:8,nameVariants:["Cyril of Alexandria","Cyril"]},
 {id:"j",canonicalName:"St. John Chrysostom",indexed:32,nameVariants:["Свети Јован Златоусти"]}
];
test("catalogue canonical name and Serbian variants",()=>{
 assert.deepEqual(resolve("St. Basil the Great on creation",rows).authorIds,["b"]);
 assert.deepEqual(resolve("Учење светог Василија Великог",rows).authorIds,["b"]);
 assert.deepEqual(resolve("Шта Свети Јован Златоусти каже?",rows).authorIds,["j"]);
});
test("previously unhardcoded author and missing indexed material",()=>{
 assert.deepEqual(resolve("Cyril of Jerusalem on baptism",rows).authorIds,["c"]);
 assert.equal(resolve("Maximus the Confessor on wills",rows).reason,"AUTHOR_NOT_INDEXED");
});
test("Gregory duplicate records never select arbitrary ID",()=>{
 const r=resolve("Gregory of Nyssa on the soul",rows);
 assert.equal(r.reason,"DUPLICATE_INDEXED_AUTHOR_IDS");
 assert.equal(r.authorIds,undefined);
});
test("unknown saints cannot fall back to another author",()=>{
 assert.equal(resolve("Saint Photios on prayer",rows).status,"UNRESOLVED_NAMED_AUTHOR");
 assert.equal(resolve("How can we pray?",rows).scope,"GLOBAL");
});
test("two-author comparison and incomplete comparison",()=>{
 assert.equal(resolve("Compare Basil the Great and Cyril of Jerusalem",rows).scope,"MULTI_AUTHOR");
 assert.equal(resolve("Compare Basil the Great and Maximus the Confessor",rows).reason,"AUTHOR_NOT_INDEXED");
 assert.equal(resolve("Compare Basil the Great with unknown saint",rows).reason,"INCOMPLETE_COMPARISON");
});
test("short names, substring traps and overlapping aliases fail safe",()=>{
 assert.equal(resolve("basilica architecture",rows).scope,"GLOBAL");
 assert.equal(resolve("What does Cyril teach?",rows).scope,"GLOBAL");
 const collision=[...rows,{id:"other",canonicalName:"Another Basil",indexed:1,nameVariants:["Basil the Great"]}];
 assert.equal(resolve("Basil the Great on creation",collision).reason,"COLLIDING_CATALOG_ALIASES");
});
test("reject invalid questions and absent catalogs",()=>{
 assert.throws(()=>resolve("",rows),/Invalid/);
 assert.throws(()=>resolve("Hi",[]),/Missing/);
});

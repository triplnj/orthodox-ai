import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveReviewedLogicalAuthor as reviewed} from "../scripts/patristics/resolve-reviewed-logical-author.mjs";
import {resolveAuthorCatalogV2 as original} from "../scripts/patristics/resolve-author-catalog-v2.mjs";
const manifest=JSON.parse(readFileSync("tests/fixtures/patristic-gregory-logical-identity-review.json","utf8"));
const rows=[
 {id:"author_8acfb0ee0a6f046a3528db5d6587582f",canonicalName:"St. Gregory of Nyssa",indexed:175,nameVariants:["Gregory of Nyssa","Свети Григорије Ниски"]},
 {id:"author_70a3fd40c93b35acefdd905186e79922",canonicalName:"St. Gregory of Nyssa",indexed:5,nameVariants:["Gregory of Nyssa","Gregorius Nyssenus"]},
 {id:"b",canonicalName:"St. Basil the Great",indexed:30,nameVariants:["Basil the Great"]},
 {id:"c",canonicalName:"St. Cyril of Jerusalem",indexed:6,nameVariants:["Cyril of Jerusalem"]}
];
test("Gregory two author IDs are one logical reviewed identity; no DB merge",()=>{
 const before=JSON.stringify(rows);
 assert.equal(original("Gregory of Nyssa on the soul",rows).reason,"DUPLICATE_INDEXED_AUTHOR_IDS");
 const r=reviewed("Gregory of Nyssa on the soul",rows,manifest);
 assert.equal(r.scope,"SINGLE_AUTHOR");
 assert.equal(r.reason,"REVIEWED_LOGICAL_AUTHOR_GROUP");
 assert.deepEqual([...r.authorIds].sort(),[...manifest.workAuthorIds].sort());
 assert.deepEqual(r.authors,["St. Gregory of Nyssa"]);
 assert.equal(r.speakerVerified,false);
 assert.equal(JSON.stringify(rows),before);
});
test("logical review only solves known Gregory record pair and keeps other author routing",()=>{
 const basil=reviewed("What did St. Basil the Great teach about creation?",rows,manifest);
 assert.deepEqual(basil.authorIds,["b"]);
 const both=reviewed("Compare St. Basil the Great and St. Gregory of Nyssa",rows,manifest);
 assert.equal(both.scope,"MULTI_AUTHOR");
 assert.deepEqual(new Set(both.authorIds),new Set(["b",...manifest.workAuthorIds]));
});
test("changed duplicate IDs or untrusted manifest cannot select a primary arbitrarily",()=>{
 const changed=rows.map(r=>r.id===manifest.workAuthorIds[0]?{...r,id:"different"}:r);
 assert.throws(()=>reviewed("Gregory of Nyssa",changed,manifest),/Catalog diverged/);
 assert.throws(()=>reviewed("Gregory of Nyssa",rows,{...manifest,purpose:"USER_SUPPLIED"}),/Unapproved logical/);
});

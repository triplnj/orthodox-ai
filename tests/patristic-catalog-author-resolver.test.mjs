import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildAuthorAliasIndex,resolveAuthorScopeFromCatalog,canonicalNameFilter} from "../scripts/patristics/catalog-author-resolver.mjs";
const registry=JSON.parse(readFileSync("tests/fixtures/patristic-reviewed-author-aliases-v1.json","utf8"));
const rows=[
 ["St. Athanasius of Alexandria","author_a",4],
 ["St. Basil the Great","author_b",29],
 ["St. Cyril of Jerusalem","author_c",6],
 ["St. Gregory of Nyssa","author_g1",175],
 ["St. Gregory of Nyssa","author_g2",5],
 ["St. John Chrysostom","author_j",72],
 ["Augustine of Hippo","pilot_augustinus",0]
].map(([canonicalName,id,indexed])=>({canonicalName,id,indexed,nameVariants:[]}));
const resolve=q=>resolveAuthorScopeFromCatalog(q,rows,registry);
test("catalogue names are resolved without saint-specific logic",()=>{
 for(const [q,author] of [
 ["Why does Athanasius begin with creation?","St. Athanasius of Alexandria"],
 ["Шта Свети Василије Велики говори о стварању?","St. Basil the Great"],
 ["What does Cyril of Jerusalem teach?","St. Cyril of Jerusalem"],
 ["Шта Свети Јован Златоусти учи?","St. John Chrysostom"]
 ]){
  const r=resolve(q);
  assert.equal(r.scope,"SINGLE_AUTHOR",q);
  assert.deepEqual(r.authors,[author],q);
 }
});
test("duplicate Gregory canonical records form a safe complete group",()=>{
 const r=resolve("What does Gregory of Nyssa say about the soul?");
 assert.equal(r.status,"EXACT_CATALOG_GROUP_MATCH");
 assert.equal(r.scope,"SINGLE_AUTHOR");
 assert.deepEqual(r.authorGroups[0].authorIds,["author_g1","author_g2"]);
 assert.deepEqual(canonicalNameFilter(r).canonicalNames,["St. Gregory of Nyssa"]);
});
test("unknown, ambiguous, comparison and authorless questions fail safely",()=>{
 assert.equal(resolve("What did Cyril teach about sin?").scope,"NO_AUTOMATIC_FILTER");
 assert.equal(resolve("What does St Maximus the Confessor teach?").scope,"NO_AUTOMATIC_FILTER");
 assert.equal(resolve("How does repentance prepare believers for baptism?").scope,"GLOBAL");
 assert.equal(resolve("Compare Basil and Maximus on salvation.").scope,"NO_AUTOMATIC_FILTER");
 assert.equal(resolve("Compare Athanasius and Cyril of Jerusalem on salvation.").scope,"MULTI_AUTHOR");
 assert.equal(resolve("How is basilica architecture described?").scope,"GLOBAL");
});
test("persisted nameVariants support new authors without edits to resolver",()=>{
 const extended=[...rows,{id:"author_maximus",canonicalName:"St. Maximus the Confessor",nameVariants:["Свети Максим Исповедник"],indexed:13}];
 const r=resolveAuthorScopeFromCatalog("Шта Свети Максим Исповедник учи о вољи?",extended,registry);
 assert.equal(r.scope,"SINGLE_AUTHOR");
 assert.deepEqual(r.authors,["St. Maximus the Confessor"]);
});
test("collision across canonical names rejects routing instead of choosing first match",()=>{
 const modified={...registry,entries:[...registry.entries,{canonicalName:"St. Gregory of Nyssa",variants:["Basil"]}]};
 const r=resolveAuthorScopeFromCatalog("What does Basil teach?",rows,modified);
 assert.equal(r.reason,"ALIAS_COLLISION");
 assert.equal(r.scope,"NO_AUTOMATIC_FILTER");
});
test("invalid registry and malformed persisted aliases fail closed",()=>{
 assert.throws(()=>buildAuthorAliasIndex(rows,{schemaVersion:1,entries:[]}),/registry/);
 assert.throws(()=>buildAuthorAliasIndex([...rows,{canonicalName:"St. New Father",id:"new",indexed:1,nameVariants:[12]}],registry),/Malformed/);
 assert.equal(canonicalNameFilter({status:"REVIEW_REQUIRED",reason:"DUPLICATE"}).allowed,false);
});

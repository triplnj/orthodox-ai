import test from "node:test";
import assert from "node:assert/strict";
import {resolveAuthorScope,stagingAuthorFilterDecision} from "../scripts/patristics/resolve-author-scope.mjs";
const rows=[
 ["St. Athanasius of Alexandria","author_a",4],
 ["St. Basil the Great","author_b",29],
 ["St. Cyril of Jerusalem","author_c",6],
 ["St. Gregory of Nyssa","author_g1",175],
 ["St. Gregory of Nyssa","author_g2",5],
 ["St. John Chrysostom","author_j",72],
 ["Augustine of Hippo","author_aug",0]
].map(([canonicalName,id,indexed])=>({canonicalName,id,indexed}));
test("only explicit whole-phrase catalogue aliases filter",()=>{
 const q=resolveAuthorScope("Why does Athanasius begin with creation?",rows);
 assert.equal(q.scope,"SINGLE_AUTHOR");assert.deepEqual(q.authorIds,["author_a"]);
 assert.equal(resolveAuthorScope("What did Cyril of Jerusalem teach about baptism?",rows).scope,"SINGLE_AUTHOR");
 assert.equal(resolveAuthorScope("Шта Свети Василије Велики учи о творевини?",rows).scope,"SINGLE_AUTHOR");
 assert.equal(resolveAuthorScope("What does John Chrysostom teach?",rows).scope,"SINGLE_AUTHOR");
});
test("authorless questions do not invent a saint and unknown names are not redirected",()=>{
 const a=resolveAuthorScope("How does repentance relate to salvation?",rows);
 assert.equal(a.scope,"GLOBAL");assert.equal(a.status,"NO_EXPLICIT_AUTHOR");
 const b=resolveAuthorScope("What does St Maximus the Confessor teach about wills?",rows);
 assert.equal(b.status,"UNRESOLVED_NAMED_AUTHOR");
 assert.equal(stagingAuthorFilterDecision(b).allowed,false);
 const c=resolveAuthorScope("What does Cyril say about faith?",rows);
 assert.equal(c.scope,"NO_AUTOMATIC_FILTER");
});
test("comparative queries require exactly two verified catalogue authors",()=>{
 const a=resolveAuthorScope("Compare Athanasius and Cyril of Jerusalem on salvation.",rows);
 assert.equal(a.scope,"MULTI_AUTHOR");assert.equal(a.authorIds.length,2);
 const b=resolveAuthorScope("Compare Basil and Gregory of Nyssa",rows);
 assert.equal(b.status,"REVIEW_REQUIRED");
 assert.equal(b.reason,"MISSING_OR_DUPLICATE_INDEXED_AUTHOR_RECORD");
 const c=resolveAuthorScope("Compare Basil and Maximus on Christ.",rows);
 assert.equal(c.status,"REVIEW_REQUIRED");assert.equal(c.scope,"NO_AUTOMATIC_FILTER");
});
test("duplicate author records fail closed and no substring alias routing",()=>{
 const q=resolveAuthorScope("How does Gregory of Nyssa view the soul?",rows);
 assert.equal(q.reason,"MISSING_OR_DUPLICATE_INDEXED_AUTHOR_RECORD");
 assert.equal(stagingAuthorFilterDecision(q).allowed,false);
 assert.equal(resolveAuthorScope("How is basilica architecture described?",rows).scope,"GLOBAL");
 assert.equal(resolveAuthorScope("What does augustine say about grace?",rows).scope,"NO_AUTOMATIC_FILTER");
});
test("reject invalid inputs, avoid unapproved production filters",()=>{
 assert.throws(()=>resolveAuthorScope("",rows),/Invalid/);
 assert.throws(()=>resolveAuthorScope("Hi",[]),/catalog/);
 assert.deepEqual(stagingAuthorFilterDecision({status:"INVALID"}),{allowed:false,reason:"INVALID_ROUTE"});
});

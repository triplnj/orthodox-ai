import test from "node:test";
import assert from "node:assert/strict";
import {prepareSourceBatch} from "../scripts/patristics/prepare-source-batch.mjs";
import {stageSourceBatch} from "../scripts/patristics/stage-source-batch.mjs";

const make=(author,title,text)=>({
 author,title,editionTitle:"19th century public domain English translation",
 corpus:"CURATED_OTHER",language:"English",
 sourceUrl:"https://example.org/"+title.replace(/\s+/g,"-"),
 licenseNote:"Reviewed: translation published in 1890, public domain in target jurisdiction.",
 rightsReviewed:true,
 paragraphs:[{locator:"Book I / Chapter 1",text}]
});
const manifest={schemaVersion:1,works:[
 make("St. Basil the Great","Hexaemeron","The Creator of all things brought the world into being."),
 make("St. John Chrysostom","Homily on Scripture","Let us attend closely to the Scriptures and the life of prayer.")
]};
const env={LIBRARY_STAGING_BRANCH_ID:"br-test-branch",
 LIBRARY_STAGING_DB_URL:"postgresql://user:password@ep-test.eu-central-1.aws.neon.tech/neondb"};

test("multiple fathers are prepared with distinct stable source identifiers",()=>{
 const r=prepareSourceBatch(manifest);
 assert.equal(r.counts.authors,2);
 assert.equal(r.counts.works,2);
 assert.equal(r.counts.editions,2);
 assert.equal(r.counts.passages,2);
 assert.notEqual(r.works[0].authorId,r.works[1].authorId);
 assert.deepEqual(prepareSourceBatch(manifest),r);
});
test("long paragraphs split into bounded, lossless chunks",()=>{
 const long="Faith and prayer work together. ".repeat(110);
 const m={schemaVersion:1,works:[make("St. Basil the Great","Hexaemeron",long)]};
 const r=prepareSourceBatch(m);
 assert.ok(r.passages.length>1);
 assert.ok(r.passages.every(p=>p.content.length<=1500));
 assert.equal(r.passages.map(p=>p.content).join(""),long);
});
test("preserves trailing spaces and line breaks in source passages",()=>{
 const text="Original passage with a trailing space and line ending. \\n";
 const m={schemaVersion:1,works:[make("St. Basil the Great","Hexaemeron",text)]};
 const prepared=prepareSourceBatch(m);
 assert.equal(prepared.passages[0].content,text);
});
test("rejects whitespace-only passages instead of admitting empty content",()=>{
 const m={schemaVersion:1,works:[make("St. Basil the Great","Hexaemeron","  \\n  ")]};
 assert.throws(()=>prepareSourceBatch(m),/invalid paragraph/);
});
test("invalid or undocumented usage rights fail before staging",()=>{
 assert.throws(()=>prepareSourceBatch({schemaVersion:1,works:[{...manifest.works[0],rightsReviewed:false}]}),/rights/);
 assert.throws(()=>prepareSourceBatch({schemaVersion:1,works:[{...manifest.works[0],paragraphs:[]}]}),/rights/);
});
test("branch guard rejects wrong DB before transaction",async()=>{
 const q=[];
 const db={async connect(){},async end(){},async query(sql){
  q.push(sql);
  if(sql.includes('"LibraryStagingGuard"'))return {rows:[{branchId:"br-wrong",purpose:"PATRISTIC_LIBRARY_STAGING"}]};
  throw Error("Unexpected SQL");
 }};
 await assert.rejects(stageSourceBatch(manifest,env,{db}),/non-staging/);
 assert.equal(q.length,1);
});
test("production-shaped configuration cannot connect",async()=>{
 await assert.rejects(stageSourceBatch(manifest,{...env,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/postgres"}),/Invalid staging/);
});

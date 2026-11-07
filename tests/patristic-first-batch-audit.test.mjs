import test from "node:test";
import assert from "node:assert/strict";
import {auditFirstSourceBatch} from "../scripts/patristics/audit-first-source-batch.mjs";

const make=(author,title,count)=>({
 author,title,editionTitle:"Nineteenth-century edition",language:"English",
 corpus:"CURATED_OTHER",sourceUrl:"https://en.wikisource.org/wiki/"+encodeURIComponent(title),
 licenseNote:"Public domain nineteenth century translation; editorial examination is still required.",
 rightsReviewed:true,
 paragraphs:Array.from({length:count},(_,i)=>({
  locator:"Source paragraph "+String(i+1).padStart(3,"0"),
  text:"This is a realistic test paragraph about scripture and theological history, with multiple clauses. ".repeat(3)
 }))
});
const good=()=>({schemaVersion:1,works:[
 make("St. Basil the Great","Hexaemeron, Homily I",18),
 make("St. John Chrysostom","Homilies on Matthew, Homily I",70)
]});
test("audits both authors and returns source fingerprints without DB access",()=>{
 const report=auditFirstSourceBatch(good());
 assert.equal(report.results.length,2);
 assert.equal(report.status,"AUTOMATED_PREVIEW_QA_PASSED_NOT_IMPORTED");
 assert.equal(report.databaseWrites,0);
 assert.equal(report.embeddingRequests,0);
 assert.ok(report.results.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
});
test("rejects truncated Basil source",()=>{
 const src=good();
 src.works[0].paragraphs.pop();
 assert.throws(()=>auditFirstSourceBatch(src),/fewer extracted paragraphs/);
});
test("rejects replaced host or unknown edition",()=>{
 const src=good();
 src.works[0].sourceUrl="https://example.com/basil";
 assert.throws(()=>auditFirstSourceBatch(src),/Unexpected source domain/);
 const swapped=good();swapped.works[1].title="Unrelated title";
 assert.throws(()=>auditFirstSourceBatch(swapped),/Unknown edition/);
});

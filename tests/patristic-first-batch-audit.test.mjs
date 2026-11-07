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
const good=()=>{
 const works=[
 make("St. Basil the Great","Hexaemeron, Homily I",18),
 make("St. John Chrysostom","Homilies on Matthew, Homily I",70)
 ];
 works[0].paragraphs[0].text="1. It is right that any one beginning to narrate the formation of the world should begin with visible things.";
 works[1].paragraphs[0].text="It were indeed meet for us not at all to require the aid of the written Word.";
 for(const w of works) w.paragraphs.at(-1).text="To whom be all honour and glory world without end. Amen.";
 return {schemaVersion:1,works};
};
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

test("rejects a source with a missing homily ending",()=>{
 const src=good();
 src.works[1].paragraphs.at(-1).text="Unfinished final paragraph.";
 assert.throws(()=>auditFirstSourceBatch(src),/final doxology/);
});

test("accepts heading and biblical epigraph before the genuine opening",()=>{
 const src=good();
 src.works[0].paragraphs[0].text="Homily I. In the Beginning God made the Heaven and the Earth.";
 src.works[0].paragraphs[1].text="1. It is right that any one beginning to narrate the formation of the world should begin with the good order of created things.";
 assert.equal(auditFirstSourceBatch(src).results.length,2);
});
test("rejects a source missing its real opening even with enough paragraphs",()=>{
 const src=good();
 src.works[0].paragraphs[0].text="Unrelated material about a different work.";
 assert.throws(()=>auditFirstSourceBatch(src),/beginning marker/);
});

test("accepts a genuine opening after more than eight short preliminary paragraphs",()=>{
 const src=good();
 for(let i=0;i<9;i++)src.works[1].paragraphs[i].text="Homily introduction heading "+(i+1)+".";
 src.works[1].paragraphs[9].text="It were indeed meet for us not at all to require the aid of the written Word.";
 assert.equal(auditFirstSourceBatch(src).results.length,2);
});

test("accepts Wikisource word-join artifact in Chrysostom opening",()=>{
 const src=good();
 src.works[1].paragraphs[0].text="Homilies of St. John Chrysostom, archbishop of constantinople, on the gospel according to st. matthew. Homily I. It were indeed meet for us not at all to requirethe aid of the written Word.";
 assert.equal(auditFirstSourceBatch(src).results.length,2);
});

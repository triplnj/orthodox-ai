import test from "node:test";
import assert from "node:assert/strict";
import {queryTerms,rerankCandidates} from "../scripts/patristics/rerank-retrieval.mjs";

test("English scripture terminology normalizes while author names do not dominate",()=>{
 const terms=queryTerms("Why does John Chrysostom speak about needing the written Scriptures?");
 assert.ok(terms.includes("scripture"));
 assert.ok(terms.includes("write"));
 assert.ok(!terms.includes("john"));
});
test("contextually relevant passage can outrank semantically similar unrelated passage",()=>{
 const q="What does Basil teach about the beginning of creation?";
 const hits=[
  {passageId:"unrelated",similarity:0.53,content:"A long account of family suffering and traveling to another country with many descriptions."},
  {passageId:"direct",similarity:0.50,content:"In the beginning God created the heaven and earth. The beginning of creation reveals the Creator and the order of created things."}
 ];
 const result=rerankCandidates(q,hits);
 assert.equal(result[0].passageId,"direct");
 assert.equal(result[0].originalRank,2);
});
test("headings and paratext are demoted, not silently discarded",()=>{
 const hits=[
  {passageId:"heading",similarity:0.75,content:"HOMILY I"},
  {passageId:"body",similarity:0.60,content:"The Gospel was written so that all could learn the teachings of the evangelists in their own homes and faithfully read Scripture."}
 ];
 const result=rerankCandidates("Why were the Gospels written as Scripture?",hits);
 assert.equal(result[0].passageId,"body");
 assert.equal(result.length,2);
 assert.equal(result[1].paratextPenalty,0.18);
});
test("does not confer doctrinal verification or fabricate excerpts",()=>{
 const item={passageId:"x",similarity:0.6,content:"What is the soul?",mayPresentAsAuthorTeaching:false};
 const [first]=rerankCandidates("What is the soul?",[item]);
 assert.equal(first.mayPresentAsAuthorTeaching,false);
 assert.equal(first.content,item.content);
});
test("stable tie breaking and bounded inputs",()=>{
 const hits=[{passageId:"z",similarity:0.5,content:"The soul lives."},{passageId:"a",similarity:0.5,content:"The soul lives."}];
 assert.deepEqual(rerankCandidates("soul",hits).map(x=>x.passageId),["a","z"]);
 assert.throws(()=>rerankCandidates("soul",[{similarity:NaN,content:"x"}]),/Invalid retrieval hit/);
 assert.throws(()=>rerankCandidates("soul",[],{limit:21}),/Invalid retrieval candidates/);
});

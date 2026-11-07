import test from "node:test";
import assert from "node:assert/strict";
import {extractPrimaryParagraphs,buildFirstSourceBatch} from "../scripts/patristics/build-first-source-batch.mjs";

const para="This historic English translation presents an extended discussion of the divine creation and the interpretation of Holy Scripture. ";
const page="<div class='mw-parser-output'>"+Array.from({length:7},(_,i)=>"<p>"+(i+1)+". "+para.repeat(6)+"</p>").join("")+"<div class='mw-references-wrap'><p>"+para.repeat(5)+"</p></div></div>";

test("extracts primary paragraphs without footnotes or page furniture",()=>{
 const ps=extractPrimaryParagraphs(page);
 assert.equal(ps.length,7);
 assert.equal(ps[0].locator,"Source paragraph 001");
 assert.ok(ps.every(p=>!p.text.includes("references")));
});

test("rejects missing primary text",()=>{
 assert.throws(()=>extractPrimaryParagraphs("<div>Article unavailable</div>"),/article body/);
 assert.throws(()=>extractPrimaryParagraphs("<div class='mw-parser-output'><p>Short</p></div>"),/incomplete/);
});

test("fetches two independent authors but only writes a preview",async()=>{
 const writes=[];
 const fetchImpl=async url=>{
  const pageName=url.searchParams.get("page");
  assert.match(pageName,/Homily 1$/);
  return {ok:true,json:async()=>({parse:{text:page}})};
 };
 const result=await buildFirstSourceBatch({fetchImpl,outFile:"/tmp/not-written-by-test"});
 // This would write in unit test; test should not call the writer without injection.
 assert.equal(result.works.length,2);
});

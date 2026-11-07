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

test("preserves short paragraphs, including brief transitions",()=>{
 const shortPage="<div class='mw-parser-output'>"+
   Array.from({length:5},(_,i)=>"<p>"+para.repeat(6)+"</p>").join("")+
   "<p>But why?</p><p>Therefore.</p></div>";
 const extracted=extractPrimaryParagraphs(shortPage);
 assert.equal(extracted.length,7);
 assert.equal(extracted[5].text,"But why?");
 assert.equal(extracted[6].text,"Therefore.");
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
 const result=await buildFirstSourceBatch({fetchImpl,outFile:"preview.json",writeImpl:async (name,data,options)=>{
  assert.equal(name,"preview.json");
  assert.equal(options.flag,"wx");
  writes.push(JSON.parse(data));
 }});
 assert.equal(result.works.length,2);
 assert.equal(writes.length,1);
 assert.equal(writes[0].works.length,2);
 assert.notEqual(writes[0].works[0].author,writes[0].works[1].author);
 assert.equal(result.status,"LOCAL_PREVIEW_ONLY");
});

test("preserves a word boundary where Wikisource inserts a footnote",()=>{
 const joined="<div class='mw-parser-output'><p>"+
  "It were indeed meet for us not at all to require"+
  "<sup class='reference'><a href='#cite_note-1'>[1]</a></sup>"+
  "the aid of the written Word. "+
  para.repeat(50)+"</p>"+
  Array.from({length:5},()=>"<p>"+para.repeat(6)+"</p>").join("")+"</div>";
 const ps=extractPrimaryParagraphs(joined);
 assert.match(ps[0].text,/require the aid/);
 assert.doesNotMatch(ps[0].text,/requirethe/);
 assert.doesNotMatch(ps[0].text,/\[1\]/);
});

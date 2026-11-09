import test from "node:test";
import assert from "node:assert/strict";
import {extractText,previewNewWorks,SOURCES} from "../scripts/patristics/preview-new-works-staging.mjs";
test("new editions represent two different fathers and works",()=>{
 assert.deepEqual(SOURCES.map(x=>x.author),["St. Athanasius of Alexandria","St. Cyril of Jerusalem"]);
 assert.ok(SOURCES.every(x=>x.publicationYear<1900));
});
test("extract only numbered source paragraphs and reject navigation or tiny articles",()=>{
 const html='<div class="mw-parser-output"><p>§1. '+("Introductory theological statement. ".repeat(75))+'</p><p>2. '+("Continuation of theological discussion. ".repeat(80))+'</p><p>3. '+("Conclusion of a source argument. ".repeat(70))+'</p><table><tr><td>Navigation</td></tr></table></div>';
 const result=extractText(html,{minimumCharacters:2000});
 assert.equal(result.paragraphs.length,3);
 assert.equal(result.numberedSections,3);
 assert.match(result.textSha256,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(result).includes("Navigation"));
 assert.throws(()=>extractText('<p>Some text</p>'),/article body/);
 assert.throws(()=>extractText('<div class="mw-parser-output"><p>Short</p></div>'),/too short/);
});
test("preview is draft only; no DB, embeddings or import",async()=>{
 const html='<div class="mw-parser-output">'+Array.from({length:5},(_,i)=>'<p>'+(i+1)+'. '+("Source passage for edition checking. ".repeat(45))+'</p>').join('')+'</div>';
 let downloads=0;let writes=0;let document;
 const result=await previewNewWorks({
   fetchImpl:async url=>{downloads++;assert.equal(url.origin,"https://en.wikisource.org");return {ok:true,json:async()=>({parse:{text:html}})}},
   writeImpl:async (_file,content,opts)=>{writes++;document=JSON.parse(content);assert.equal(opts.flag,"wx");},
   outputPath:"preview.json"
 });
 assert.equal(downloads,2);assert.equal(writes,1);
 assert.equal(result.databaseWrites,0);
 assert.equal(document.notApprovedForImport,true);
 assert.ok(document.works.every(x=>x.rightsStatus==="PENDING_EDITORIAL_REVIEW"&&x.importStatus==="PREVIEW_NOT_STAGED"));
 assert.ok(document.works.every(x=>x.paragraphs.every(p=>p.locator.startsWith("Source paragraph"))));
});

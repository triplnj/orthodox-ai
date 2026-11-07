/**
 * Generic offline, multi-author/multi-work source manifest validator and chunker.
 * No network, DB, OpenAI, live chat. Input JSON is maintained by operator;
 * only texts with explicit documented use permissions are accepted.
 *
 * Example manifest:
 * {
 *  "schemaVersion":1,
 *  "works":[{
 *    "author":"St. Maximus the Confessor",
 *    "title":"Example work",
 *    "editionTitle":"Documented public domain edition",
 *    "corpus":"CURATED_OTHER","language":"English",
 *    "sourceUrl":"https://example.org/primary-source",
 *    "licenseNote":"Public-domain translation: bibliographic evidence ...",
 *    "rightsReviewed":true,
 *    "paragraphs":[{"locator":"chapter 1","text":"Original verified full text ..."}]
 *  }]
 * }
 */
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const CORPORA=new Set(["PG","PL","PHILOKALIA","MODERN_ORTHODOX","CURATED_OTHER"]);
const digest=s=>createHash("sha256").update(s,"utf8").digest("hex");
const stable=(prefix,...parts)=>prefix+"_"+digest(JSON.stringify(parts)).slice(0,32);
const proper=(s,max=500)=>typeof s==="string" && s.trim()===s && s.length>0 && s.length<=max;
function validateWork(w){
  if(!w || !proper(w.author,200) || !proper(w.title,300) ||
    !proper(w.editionTitle,300)||!CORPORA.has(w.corpus)||
    !proper(w.language,50)||!proper(w.sourceUrl,1000)||
    !/^https:\/\/[^\s]+$/i.test(w.sourceUrl)||
    !proper(w.licenseNote,2000)||w.licenseNote.length<25 ||
    w.rightsReviewed!==true ||
    !Array.isArray(w.paragraphs) || w.paragraphs.length===0 || w.paragraphs.length>10000){
      throw Error("Source lacks verified metadata, rights review, or valid paragraphs");
  }
  const seen=new Set();
  for(const p of w.paragraphs){
    if(!p || !proper(p.locator,250)||typeof p.text!=="string" ||
      p.text.length>200000 || !p.text.trim() ||
      seen.has(p.locator)) throw Error("Empty, duplicate or invalid paragraph/locator");
    seen.add(p.locator);
  }
}
function splitText(text,maxChars=1500){
  const out=[];let pos=0;
  while(pos<text.length){
    let end=Math.min(pos+maxChars,text.length);
    if(end<text.length){
      const space=text.lastIndexOf(" ",end);
      if(space>pos+Math.floor(maxChars*0.6)) end=space+1;
    }
    out.push(text.slice(pos,end));
    pos=end;
  }
  return out;
}
export function prepareSourceBatch(manifest){
  if(!manifest || manifest.schemaVersion!==1 || !Array.isArray(manifest.works) ||
     manifest.works.length===0 || manifest.works.length>100) throw Error("Expected manifest schemaVersion 1 with 1..100 works");
  const editions=new Set();const works=[];const passages=[];
  for(const w of manifest.works){
    validateWork(w);
    const authorId=stable("author",w.author.toLocaleLowerCase());
    const workId=stable("work",authorId,w.title.toLocaleLowerCase());
    const editionId=stable("edition",workId,w.editionTitle,w.sourceUrl);
    if(editions.has(editionId))throw Error("Duplicate edition in manifest");
    editions.add(editionId);
    works.push({authorId,author:w.author,workId,title:w.title,editionId,
      editionTitle:w.editionTitle,sourceUrl:w.sourceUrl,corpus:w.corpus,
      language:w.language,licenseNote:w.licenseNote,translator:w.translator??null});
    for(const p of w.paragraphs){
      const parts=splitText(p.text);
      parts.forEach((content,ordinal)=>{
        passages.push({id:stable("passage",editionId,p.locator,ordinal),editionId,
          locator:p.locator,ordinal,content,sha256:digest(content),language:w.language});
      });
      if(parts.join("")!==p.text)throw Error("Chunking lost source text");
    }
  }
  return {status:"VALIDATED_NOT_IMPORTED",works,passages,
    counts:{authors:new Set(works.map(w=>w.authorId)).size,
      works:new Set(works.map(w=>w.workId)).size,editions:works.length,passages:passages.length}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2];
  if(!path || process.argv.length!==3){process.stderr.write("Usage: node scripts/patristics/prepare-source-batch.mjs <local-manifest.json>\n");process.exitCode=1;}
  else readFile(path,"utf8").then(JSON.parse).then(prepareSourceBatch).then(x=>
    process.stdout.write(JSON.stringify({status:x.status,counts:x.counts,editions:x.works.map(
      w=>({author:w.author,title:w.title,editionId:w.editionId,sourceUrl:w.sourceUrl}))},null,2)+"\n")
  ).catch(e=>{process.stderr.write("SOURCE_PREP_FAILED: "+e.message+"\n");process.exitCode=1;});
}

import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {prepareCleanEvidence} from "../scripts/patristics/clean-new-works-preview.mjs";
const hash=s=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const a=["On the Incarnation of the Word.","————————————","§1. Introductory description.",
    "Whereas in what precedes "+("historical patristic text on the Word and creation. ".repeat(49))];
 const c=["FIRST CATECHETICAL LECTURE","of","Our Holy Father Cyril,","Archbishop of Jerusalem,",
  "To those who are to be Enlightened","With a reading from Isaiah","Wash you, make you clean",
  ...Array.from({length:6},(_,i)=>(i+1)+". "+("catechetical instruction and preparation. ".repeat(35)))];
 const work=(author,title,list)=>({author,title,editionTitle:"Historical translation",
  translator:"Historic Translator",publicationYear:1892,language:"English",
  sourceUrl:"https://en.wikisource.org/wiki/Primary",
  sourceTextSha256:hash(list.join("\n\n")),
  rightsStatus:"PENDING_EDITORIAL_REVIEW",importStatus:"PREVIEW_NOT_STAGED",
  paragraphs:list.map((text,i)=>({locator:"Source paragraph "+String(i+1).padStart(3,"0"),text,sha256:hash(text)}))});
 return {purpose:"TWO_NEW_WORKS_SOURCE_PREVIEW_ONLY",stagingBranch:"br-spring-frost-assfzje6",
  notApprovedForImport:true,sourceCount:2,works:[
   work("St. Athanasius of Alexandria","On the Incarnation of the Word, Chapter 1",a),
   work("St. Cyril of Jerusalem","Catechetical Lecture 1",c)
  ]};
}
test("retains only Athanasius body and Cyril six numbered sections",()=>{
 const out=prepareCleanEvidence(fixture());
 assert.equal(out.kind,"CLEAN_SOURCE_CANDIDATE_NOT_APPROVED");
 assert.deepEqual(out.works.map(w=>w.paragraphs.length),[1,6]);
 assert.deepEqual(out.works.map(w=>w.discardedParatextLocators.length),[3,7]);
 assert.ok(out.works.every(w=>w.rightsStatus==="PENDING_EDITORIAL_REVIEW"&&w.importStatus==="NOT_STAGED"));
 assert.equal(out.works[0].paragraphs[0].locator,"Chapter I, §1");
 assert.equal(out.works[1].paragraphs[5].locator,"Catechetical Lecture I, §6");
 assert.ok(out.works.every(w=>w.paragraphs.every(p=>p.sha256===hash(p.text))));
});
test("changed source, altered paragraph numbering and unauthorized approval fail closed",()=>{
 const changed=fixture();changed.works[0].paragraphs[3].text+=" tamper";
 assert.throws(()=>prepareCleanEvidence(changed),/hash mismatch/);
 const renumbered=fixture();renumbered.works[1].paragraphs[8].text="WRONG"+renumbered.works[1].paragraphs[8].text;
 renumbered.works[1].paragraphs[8].sha256=hash(renumbered.works[1].paragraphs[8].text);
 assert.throws(()=>prepareCleanEvidence(renumbered),/section boundary/);
 const wronglyApproved=fixture();wronglyApproved.notApprovedForImport=false;
 assert.throws(()=>prepareCleanEvidence(wronglyApproved),/Wrong preview/);
});

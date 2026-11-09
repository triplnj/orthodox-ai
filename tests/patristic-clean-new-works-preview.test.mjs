import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {prepareCleanEvidence} from "../scripts/patristics/clean-new-works-preview.mjs";
const hash=s=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const a=["On the Incarnation of the Word.","————————————","§1. Introductory description.",
    "Whereas in what precedes "+("historical patristic text on the Word and creation. ".repeat(40))+
    " 2. For the more He is mocked among the unbelieving, His power shines forth."+
    " 3. But to treat this subject it is necessary to recall what was said before."+
    " 4. It is, then, proper for us to begin by discussing creation and the Word."];
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
test("preserves four Athanasius authorial sections and six Cyril sections",()=>{
 const out=prepareCleanEvidence(fixture());
 assert.equal(out.kind,"CLEAN_SOURCE_CANDIDATE_NOT_APPROVED");
 assert.deepEqual(out.works.map(w=>w.paragraphs.length),[4,6]);
 assert.deepEqual(out.works[0].paragraphs.map(p=>p.locator),["Chapter I, §1","Chapter I, §2","Chapter I, §3","Chapter I, §4"]);
 assert.equal(out.works[0].paragraphs.map(p=>p.text).join(" "),fixture().works[0].paragraphs[3].text);
 assert.deepEqual(out.works.map(w=>w.discardedParatextLocators.length),[3,7]);
 assert.ok(out.works.every(w=>w.rightsStatus==="PENDING_EDITORIAL_REVIEW"&&w.importStatus==="NOT_STAGED"));
 assert.equal(out.works[0].paragraphs[0].locator,"Chapter I, §1");
 assert.equal(out.works[1].paragraphs[5].locator,"Catechetical Lecture I, §6");
 assert.ok(out.works.every(w=>w.paragraphs.every(p=>p.sha256===hash(p.text))));
 assert.ok(out.works[0].paragraphs.every(p=>p.parentSourceSha256===hash(fixture().works[0].paragraphs[3].text)));
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

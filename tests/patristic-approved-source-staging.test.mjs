import test from "node:test";
import assert from "node:assert/strict";
import {approvedSourceStaging} from "../scripts/patristics/approved-source-staging.mjs";
import {auditFirstSourceBatch} from "../scripts/patristics/audit-first-source-batch.mjs";

const make=(author,title,count)=>({
 author,title,editionTitle:"Historical public domain translation",language:"English",
 corpus:"CURATED_OTHER",sourceUrl:"https://en.wikisource.org/wiki/"+encodeURIComponent(title),
 licenseNote:"Public domain nineteenth century translation; editorial review before deployment required.",
 rightsReviewed:true,
 paragraphs:Array.from({length:count},(_,i)=>({
  locator:"Source paragraph "+String(i+1).padStart(3,"0"),
  text:"The writings of the Fathers contain homilies concerning the creation of the world. ".repeat(4)
 }))
});
const manifest=()=>{
 const works=[
 make("St. Basil the Great","Hexaemeron, Homily I",18),
 make("St. John Chrysostom","Homilies on Matthew, Homily I",70)
 ];
 works[0].paragraphs[0].text="1. It is right that any one beginning to narrate the formation of the world should begin with the divine creation.";
 works[1].paragraphs[0].text="It were indeed meet for us not at all to require the aid of the written Word.";
 for(const w of works)w.paragraphs.at(-1).text="Glory to God now and ever and for ever and ever. Amen.";
 return {schemaVersion:1,works};
};
test("matching hash and explicit approval permit staging only",async()=>{
 const m=manifest(),hash=auditFirstSourceBatch(m).manifestSha256;
 let called=0;
 const result=await approvedSourceStaging(m,hash,{PATRISTIC_STAGING_APPROVAL:"STAGE_REVIEWED_SOURCE_ONLY"},
  {stage:async()=>{called++;return {status:"STAGED_UNREVIEWED",counts:{editions:2}};}});
 assert.equal(called,1);
 assert.equal(result.status,"STAGED_UNREVIEWED");
 assert.equal(result.reviewedManifestSha256,hash);
});
test("changed source never reaches the database",async()=>{
 const m=manifest(),hash=auditFirstSourceBatch(m).manifestSha256;
 m.works[0].paragraphs[0].text+=" Source changed.";
 let called=false;
 await assert.rejects(approvedSourceStaging(m,hash,{PATRISTIC_STAGING_APPROVAL:"STAGE_REVIEWED_SOURCE_ONLY"},
  {stage:async()=>{called=true;}}),/Source changed/);
 assert.equal(called,false);
});
test("missing manual approval prevents stage",async()=>{
 const m=manifest(),hash=auditFirstSourceBatch(m).manifestSha256;
 await assert.rejects(approvedSourceStaging(m,hash,{},{
  stage:async()=>{throw Error("Should not stage");}
 }),/approval missing/);
});
test("invalid reviewed digest fails before any DB work",async()=>{
 await assert.rejects(approvedSourceStaging(manifest(),"invalid",{},{
  stage:async()=>{throw Error("Should not stage");}
 }),/64-hex/);
});

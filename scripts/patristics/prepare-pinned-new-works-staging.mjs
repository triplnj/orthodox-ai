/**
 * Promote exactly two byte-pinned NPNF translations from PREVIEW to
 * STAGING UNREVIEWED. Does not certify doctrinal assertions, speaker labels,
 * or activate sources in production. Independent from fixed reranker.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {prepareSourceBatch} from "./prepare-source-batch.mjs";
const digest=s=>createHash("sha256").update(s,"utf8").digest("hex");
const REFS=[
 {author:"St. Athanasius of Alexandria",title:"On the Incarnation of the Word, Chapter 1",year:1892,
  full:"5fc6c2937cd3a934bf8262837718ded0f6fdac8d48b0426fc8c87398fe65f0cb",
  hashes:["758a97b766fe2294f3fcd0d35749d8fefa7f04fd5cbea5c532a530f05eb3ab59",
   "67a45c23448b88731021713d94da166c7239fa8efe96b313063967de4c25c595",
   "d62d79086657d9b5d5f6a6005d673acfb29ff58119ce427bd0447bca9a50e757",
   "20feab3b897525b4ed875d5898ddda9a0ed92b5e891988ae21961a86078aa4c1"]},
 {author:"St. Cyril of Jerusalem",title:"Catechetical Lecture 1",year:1894,
  full:"5a9560e82b315d5c7a2b265ecc591aeff299c4f04fa17c24308bbeb9210cf8cf",
  hashes:["1607e8c0aa2aaa1ca699a9017bb2226114bc63bbda9ba34fffc9a964ca6f83bf",
   "617ef89788f7e1baa2edcc1d8c8c2fdffc058720f76f01928fe5e93a6713d2de",
   "cf63213a8994bd8f9312a80989138256c5cd297b495e4c70d7a336cca24f97a5",
   "a7a95a0a9cd46f8f305c4587fa209505575eae2d570e3735d4abe152bc4416f0",
   "235de2579949ab85c5ff61b3990300fba98936dfaa245dd26ebd21cc04aa1f33",
   "d9baf93ac4d94c5397ffde941bf0b8fbd0ef7c869c6c84f295f6f639be0092db"]}
];
export function buildPinnedNewWorksManifest(clean){
 if(clean?.kind!=="CLEAN_SOURCE_CANDIDATE_NOT_APPROVED"||
   clean.stagingBranch!=="br-spring-frost-assfzje6"||
   !Array.isArray(clean.works)||clean.works.length!==2)throw Error("Invalid pre-import candidate");
 const works=REFS.map(ref=>{
  const w=clean.works.find(x=>x.author===ref.author&&x.title===ref.title);
  if(!w||w.rightsStatus!=="PENDING_EDITORIAL_REVIEW"||
     w.editorialStatus!=="PARATEXT_REMOVED_SOURCE_COMPARISON_PENDING"||
     w.importStatus!=="NOT_STAGED"||w.publicationYear!==ref.year||
     w.sourceTextSha256!==ref.full||w.paragraphs.length!==ref.hashes.length||
     new URL(w.sourceUrl).hostname!=="en.wikisource.org")
   throw Error("Source identity, rights or original edition coverage changed");
  for(let i=0;i<w.paragraphs.length;i++){
   const p=w.paragraphs[i];
   if(p.sha256!==ref.hashes[i]||digest(p.text)!==ref.hashes[i]||
      p.locator!==(ref.author.includes("Athanasius")?"Chapter I, §":"Catechetical Lecture I, §")+(i+1))
    throw Error("Content hash or historical numbered sections changed");
  }
  return {author:w.author,title:w.title,editionTitle:w.editionTitle,
   translator:w.translator,corpus:"CURATED_OTHER",language:"English",
   sourceUrl:w.sourceUrl,
   licenseNote:"NPNF Series II English translation published in "+ref.year+
    "; Wikisource volume marks the historical edition as public domain worldwide. "+
    "Exact source bytes pinned and review of historical numbered sections completed; "+
    "theological assertions and citation faithfulness remain unreviewed (STAGING ONLY).",
   rightsReviewed:true,paragraphs:w.paragraphs.map(p=>({locator:p.locator,text:p.text}))};
 });
 const manifest={schemaVersion:1,works};
 const prepared=prepareSourceBatch(manifest);
 if(prepared.counts.authors!==2||prepared.counts.editions!==2||
   prepared.counts.passages!==10||prepared.passages.some(x=>x.content.length>1500))
   throw Error("Unexpected stage size or chunk splitting");
 return {manifest,prepared};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw Error("Usage: prepare-pinned-new-works-staging.mjs <clean.json> <manifest.json>");
  const {manifest,prepared}=buildPinnedNewWorksManifest(JSON.parse(readFileSync(input,"utf8")));
  writeFileSync(output,JSON.stringify(manifest,null,2)+"\n",{flag:"wx"});
  process.stdout.write(JSON.stringify({status:"RIGHTS_REVIEWED_STAGING_ONLY_UNREVIEWED_CONTENT",
   branchId:"br-spring-frost-assfzje6",
   editions:prepared.works.map(w=>({author:w.author,title:w.title,editionId:w.editionId})),
   passages:prepared.counts.passages,embeddingRequests:0})+"\n");
 }catch(e){process.stderr.write("PINNED_SOURCE_FAILED: "+e.message+"\n");process.exitCode=1;}
}

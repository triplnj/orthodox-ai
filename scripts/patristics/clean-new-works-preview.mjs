/**
 * Deterministic editorial clean-up of a source-preview archive JSON.
 * Removes paratext (titles, ornaments, headings, epigraphs) from the
 * evidence candidate corpus without modifying the source itself.
 * This does NOT authorize import or assert theological accuracy.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const sha=s=>createHash("sha256").update(s,"utf8").digest("hex");
export function prepareCleanEvidence(preview){
 if(preview?.purpose!=="TWO_NEW_WORKS_SOURCE_PREVIEW_ONLY"||
    preview.stagingBranch!=="br-spring-frost-assfzje6"||
    preview.notApprovedForImport!==true||preview.sourceCount!==2||
    !Array.isArray(preview.works)||preview.works.length!==2)
  throw Error("Wrong preview or unauthorized source state");
 const expected=[
  {author:"St. Athanasius of Alexandria",title:"On the Incarnation of the Word, Chapter 1",numbers:[4]},
  {author:"St. Cyril of Jerusalem",title:"Catechetical Lecture 1",numbers:[8,9,10,11,12,13]}
 ];
 const works=expected.map(spec=>{
  const w=preview.works.find(x=>x.author===spec.author&&x.title===spec.title);
  if(!w||w.rightsStatus!=="PENDING_EDITORIAL_REVIEW"||w.importStatus!=="PREVIEW_NOT_STAGED")
   throw Error("Unexpected source or source approval status");
  if(!w.paragraphs.every(p=>p.sha256===sha(p.text)))throw Error("Input paragraph hash mismatch");
  const chosen=spec.numbers.map((number,index)=>{
    const sourceLocator="Source paragraph "+String(number).padStart(3,"0");
    const p=w.paragraphs.find(x=>x.locator===sourceLocator);
    if(!p)throw Error("Missing independently inspected source "+sourceLocator);
    const locator=spec.author.includes("Athanasius")?"Chapter I, §1":"Catechetical Lecture I, §"+(index+1);
    if(spec.author.includes("Athanasius")){
      if(!p.text.startsWith("Whereas in what precedes")||p.text.length<2000)
       throw Error("Athanasius actual body moved; review manually");
    }else if(!p.text.startsWith((index+1)+". ")){
      throw Error("Cyril section boundary moved; review manually");
    }
    return {locator,text:p.text,sourceLocator,sha256:p.sha256};
  }).flatMap(p=>{
    if(!spec.author.includes("Athanasius"))return [p];
    // The Wikisource HTML has four numbered sections inside ONE <p>.
    // Keep the historical 1–4 boundaries, not the defective HTML boundary.
    const parts=p.text.split(/(?<=\.) (?=[234]\. )/);
    if(parts.length!==4||!parts[0].startsWith("Whereas in what precedes")||
       !["2. ","3. ","4. "].every((prefix,i)=>parts[i+1].startsWith(prefix))||
       parts.join(" ")!==p.text)
       throw Error("Athanasius section boundaries changed; refuse to stage");
    return parts.map((text,i)=>({locator:"Chapter I, §"+(i+1),text,
      sourceLocator:p.sourceLocator,sha256:sha(text),parentSourceSha256:p.sha256,
      sectionNumber:i+1}));
  });
  return {author:w.author,title:w.title,editionTitle:w.editionTitle,
    translator:w.translator,publicationYear:w.publicationYear,
    language:"English",sourceUrl:w.sourceUrl,sourceTextSha256:w.textSha256,
    rightsStatus:"PENDING_EDITORIAL_REVIEW",
    editorialStatus:"PARATEXT_REMOVED_SOURCE_COMPARISON_PENDING",
    importStatus:"NOT_STAGED",paragraphs:chosen,
    discardedParatextLocators:w.paragraphs.filter(p=>!chosen.some(x=>x.sourceLocator===p.locator))
       .map(p=>p.locator)};
 });
 return {schemaVersion:1,kind:"CLEAN_SOURCE_CANDIDATE_NOT_APPROVED",
   stagingBranch:"br-spring-frost-assfzje6",works};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw Error("Usage: clean-new-works-preview.mjs <preview.json> <clean.json>");
  const clean=prepareCleanEvidence(JSON.parse(readFileSync(input,"utf8")));
  writeFileSync(output,JSON.stringify(clean,null,2)+"\n",{flag:"wx"});
  process.stdout.write(JSON.stringify({status:clean.kind,works:clean.works.map(w=>({
    author:w.author,sections:w.paragraphs.length,discardedParatext:w.discardedParatextLocators.length
  })),databaseWrites:0})+"\n");
 }catch(e){process.stderr.write("CLEANUP_FAILED: "+e.message+"\n");process.exitCode=1;}
}

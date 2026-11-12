/**
 * Pure, offline bibliography answer grader.
 *
 * Input is adjudicated, structured claims transcribed from an actual Chat
 * answer. This is deliberately NOT a model-based text parser: an LLM is not
 * allowed to grade its own claims. Unassessed claims are reported separately.
 */
export type ReferenceClaim = {
 id:string;author:string;work:string;role:string;relation:string;
 parentWork?:string;sourceIds:string[];
};
export type AnswerClaim = {
 author:string; work:string; role:string; relation:string; parentWork?:string;
 citedUrls:string[]; identityStatus?:"WORK"|"EDITION"|"UNRESOLVED";
 adjudication:"HUMAN_REVIEWED"|"ASSISTANT_SCREENED"|"NOT_REVIEWED";
};
export type GroundTruthSource = {url:string;type:string};
const normalize=(s:string)=>s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const key=(r:{author:string;work:string})=>normalize(r.author)+"|"+normalize(r.work);
const canonicalURL=(s:string):string|null=>{
 try {const u=new URL(s);if(u.protocol!=="https:")return null;u.hash="";for(const k of [...u.searchParams.keys()])if(k.startsWith("utm_"))u.searchParams.delete(k);return u.toString();}
 catch{return null;}
};
export function gradeRealBibliographyAnswer(
 references:ReferenceClaim[],
 sourceRegistry:Record<string,GroundTruthSource>,
 claims:AnswerClaim[],
) {
 const records=new Map(references.map(r=>[key(r),r]));
 const rows=claims.map((claim,index)=>{
   const truth=records.get(key(claim));
   const issues:string[]=[];
   if(claim.identityStatus==="EDITION" && claim.relation==="WORK")issues.push("EDITION_AS_ORIGINAL_WORK");
   if(claim.role==="UNKNOWN_WITH_SPECULATIVE_EDITOR_COMPILER")issues.push("SPECULATIVE_AUTHORSHIP");
   if(!truth)issues.push("NOT_IN_REFERENCE_CORPUS");
   else {
     if(truth.role!==claim.role)issues.push("WRONG_ROLE");
     if(truth.relation!==claim.relation ||
       normalize(truth.parentWork??"")!==normalize(claim.parentWork??""))issues.push("WRONG_WORK_RELATION");
   }
   const cited=new Set(claim.citedUrls.map(canonicalURL).filter((url):url is string=>!!url));
   if(!cited.size)issues.push("MISSING_CITATION");
   if(truth) {
     const supported=new Set(truth.sourceIds.map(id=>canonicalURL(sourceRegistry[id]?.url??"")).filter((url):url is string=>!!url));
     if(![...cited].some(url=>supported.has(url)))issues.push("CITATION_NOT_IN_CROSSCHECKED_RECORD");
   }
   return {index,author:claim.author,work:claim.work,issues,
     inCorpus:!!truth,independentlyReviewed:claim.adjudication==="HUMAN_REVIEWED",
     exactReferenceMatch:!!truth&&issues.length===0};
 });
 const eligible=rows.filter(x=>x.independentlyReviewed);
 const evaluated=rows.filter(x=>x.inCorpus&&x.independentlyReviewed);
 const correct=evaluated.filter(x=>x.exactReferenceMatch).length;
 const evaluableUnique=new Set(evaluated.map(x=>key(x)));
 return {
   rows,observedClaims:rows.length,referenceClaims:references.length,
   humanReviewedClaims:eligible.length,
   inCorpusHumanReviewedClaims:evaluated.length,
   correctHumanReviewedClaims:correct,
   humanReviewedPrecision:evaluated.length?correct/evaluated.length:null,
   humanReviewedRecall:references.length?evaluableUnique.size/references.length:0,
   unassessedClaims:rows.filter(x=>!x.independentlyReviewed).length,
   independentlyValidated:rows.length>0&&rows.every(x=>x.independentlyReviewed),
   releaseReady:false,
 };
}

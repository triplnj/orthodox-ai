/** Derive a defensible text-evidence policy from a completed source audit.
 * This approves source-text correspondence ONLY, not quote speaker, doctrinal claim, or publication.
 * Every record not fully matched is quarantined for independent citation.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
export function finalizeStagingSourceReview(report){
 if(report?.status!=="STAGING_SOURCE_TEXT_AUDIT"||report.branchId!=="br-spring-frost-assfzje6"||
  report.total!==297||!Array.isArray(report.results)||report.results.length!==297||
  report.sourceUrls!==9||report.badHashes!==0||report.sourceFailures?.length!==0||
  report.databaseWrites!==0||report.productionChanges!==0)
  throw Error("Incomplete or unsafe staging source audit report");
 const seen=new Set();
 const records=report.results.map(r=>{
  if(typeof r.passageId!=="string"||!r.passageId||
   seen.has(r.passageId)||r.hashOk!==true||
   typeof r.sourceUrl!=="string"||!r.sourceUrl.startsWith("https://")||
   typeof r.locator!=="string"||!r.locator)
   throw Error("Missing/duplicate passage or untrusted provenance");
  seen.add(r.passageId);
  const sourceTextMatch=r.status==="FULL_NORMALIZED_MATCH"&&r.full===true;
  return {passageId:r.passageId,editionId:r.editionId,locator:r.locator,
   sourceUrl:r.sourceUrl,sourceMatchStatus:r.status,
   textCorrespondence:sourceTextMatch?"MATCHED":"QUARANTINED",
   mayBeRetrievalCandidate:sourceTextMatch,mayQuoteDirectly:false,
   speakerVerified:false,doctrinalClaimVerified:false,
   reviewReason:sourceTextMatch?"FULL_NORMALIZED_SOURCE_MATCH":"UNRESOLVED_SOURCE_CORRESPONDENCE"};
 }).sort((a,b)=>a.passageId.localeCompare(b.passageId));
 const approved=records.filter(r=>r.mayBeRetrievalCandidate).length;
 const quarantined=records.length-approved;
 if(approved!==224||quarantined!==73)
  throw Error("Unexpected source classification counts: "+approved+"/"+quarantined);
 const summary={status:"STAGING_SOURCE_MATCH_CLASSIFIED",branchId:report.branchId,
  total:297,fullTextMatch:approved,quarantined,sourceUrls:report.sourceUrls,
  quoteApprovals:0,speakerApprovals:0,productionChanges:0,
  releaseApproved:false,
  caveat:"FULL_NORMALIZED_MATCH means source page text correspondence only, not source editorial authenticity or speaker/claim approval."};
 return {summary,records};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2],out=process.argv[3];
 if(!file||!out)throw Error("Usage: node finalize-staging-source-review.mjs audit.json output.json");
 const data=finalizeStagingSourceReview(JSON.parse(readFileSync(file,"utf8")));
 writeFileSync(out,JSON.stringify(data,null,2)+"\n");
 process.stdout.write(JSON.stringify(data.summary,null,2)+"\n");
}

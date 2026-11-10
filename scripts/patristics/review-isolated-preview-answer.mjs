/** Conservative structural guard for preview answers from six opening-dialogue snippets.
 * NOT a theological proof or a general semantic truth evaluator.
 */
const unsupported=/(?:\b(?:apokatastasis|universal salvation|metempsychosis|pre.?existent souls|all souls are saved|the soul is mortal|macrina rejects resurrection|denies the resurrection)\b|апокатастаз[\p{L}]*|свеопшт[\p{L}]* спасењ[\p{L}]*|душа је смртн[\p{L}]*)/iu;
const fabricatedReferences=/(?:\b(?:PG|PL)\s*\d{2,4}\s*(?:[,.:]\s*\d+)?\b|Patrologia (?:Graeca|Latina)\s+\d{1,4})/iu;
function tokens(text){
 return String(text??"").toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu)??[];
}
function hasUnapprovedSharedQuote(answer,excerpt,n=12){
 const a=tokens(answer),b=tokens(excerpt);
 if(a.length<n||b.length<n)return false;
 const samples=new Set();
 for(let i=0;i+n<=b.length;i++)samples.add(b.slice(i,i+n).join(" "));
 for(let i=0;i+n<=a.length;i++)if(samples.has(a.slice(i,i+n).join(" ")))return true;
 return false;
}
export function reviewIsolatedPreviewAnswer(answer,sources){
 const errors=[];
 if(typeof answer!=="string"||!answer.trim())errors.push("EMPTY_ANSWER");
 if(!Array.isArray(sources)||sources.length<1||sources.length>3)errors.push("INVALID_EVIDENCE_COUNT");
 if(unsupported.test(answer))errors.push("UNSUPPORTED_HIGH_RISK_CLAIM");
 if(fabricatedReferences.test(answer))errors.push("UNVERIFIED_PATROLOGIA_REFERENCE");
 if(Array.isArray(sources))for(const s of sources){
  if(s?.verificationStatus!=="STAGING_TEXT_MATCH_ONLY"||s?.authorName!=="St. Gregory of Nyssa"||
     s?.workTitle!=="On the Soul and the Resurrection"||
     s?.metadata?.speakerVerified!==false||s?.metadata?.exactQuoteAllowed!==false||
     s?.metadata?.sourceTextMatch!==true||typeof s?.metadata?.excerpt!=="string")
   errors.push("SOURCE_NOT_PILOT_VERIFIED");
  else if(hasUnapprovedSharedQuote(answer,s.metadata.excerpt))
   errors.push("UNAPPROVED_VERBATIM_SOURCE_COPY");
 }
 return {accepted:errors.length===0,issues:[...new Set(errors)]};
}

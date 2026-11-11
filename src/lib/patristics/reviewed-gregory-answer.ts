/**
 * Conservative structural safety review for the narrow, independently text-matched
 * Gregory opening episode. NOT an independent theological truth evaluator.
 */
import type {PatristicResearchSource} from "./build-patristic-research-context";

const unsupported=/(?:\b(?:apokatastasis|universal salvation|metempsychosis|pre.?existent souls|all souls are saved|the soul is mortal|macrina rejects resurrection|denies the resurrection)\b|апокатастаз[\p{L}]*|свеопшт[\p{L}]* спасењ[\p{L}]*|душа је смртн[\p{L}]*)/iu;
const griefProhibited=/(?:\b(?:grief is not fitting|grieving is not fitting|sorrow is unbefitting|grieving is unbefitting|grief is forbidden|grief is prohibited|duty not to grieve|not to grieve for those|should not grieve for those|forbidden to grieve|never grieve|grief belongs only to)\b|забрањуј[\p{L}]*\s+да\s+се\s+тугуј[\p{L}]*|не\s+сме\s+се\s+туговат[\p{L}]*|жалост\s+је\s+забрањен[\p{L}]*|ne\s+sme\s+se\s+tugovat[\p{L}]*)/iu;
const inventedAnimal=/(?:\b(?:wild horse|horses|horse|cavalry)\b|коњиц[\p{L}]*|коњ[\p{L}]*|konjic[\p{L}]*|konj[\p{L}]*)/iu;
const fabricatedReferences=/(?:\b(?:PG|PL)\s*\d{2,4}\s*(?:[,.:]\s*\d+)?\b|Patrologia (?:Graeca|Latina)\s+\d{1,4})/iu;
const languageMistake=/(?:не\s+тужи\s+као\s+они|названа\s+учитељица(?=[,.\s]))/iu;
function tokens(text:string){return text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu)??[];}
function longSourceCopy(text:string,source:string,n=12){
 const t=tokens(text),s=tokens(source);if(t.length<n||s.length<n)return false;
 const windows=new Set<string>();for(let i=0;i+n<=s.length;i++)windows.add(s.slice(i,i+n).join(" "));
 for(let i=0;i+n<=t.length;i++)if(windows.has(t.slice(i,i+n).join(" ")))return true;
 return false;
}
export function reviewedGregoryAnswerIssues(answer:string,sources:PatristicResearchSource[],question:string):string[]{
 const errors:string[]=[];
 if(typeof answer!=="string"||answer.trim().length<50)errors.push("EMPTY_OR_TOO_SHORT");
 if(unsupported.test(answer))errors.push("UNSUPPORTED_DOCTRINAL_CLAIM");
 if(griefProhibited.test(answer))errors.push("GRIEF_MISINTERPRETATION");
 if(inventedAnimal.test(answer))errors.push("INVENTED_METAPHOR");
 if(fabricatedReferences.test(answer))errors.push("UNVERIFIED_REFERENCE");
 if(languageMistake.test(answer))errors.push("SERBIAN_TRANSLATION_ERROR");
 const lines=answer.split(/\n+/gu).map(x=>x.trim()).filter(x=>x.length>100);
 if(new Set(lines).size!==lines.length)errors.push("DUPLICATE_PARAGRAPHS");
 const cyr=(answer.match(/[\u0400-\u052F]/gu)??[]).length,alpha=(answer.match(/\p{L}/gu)??[]).length;
 if(/[\u0400-\u052F]/u.test(question)&&alpha>0&&cyr/alpha<0.55)errors.push("WRONG_SCRIPT");
 if(!/[\u0400-\u052F]/u.test(question)&&alpha>0&&cyr/alpha>0.1)errors.push("WRONG_SCRIPT");
 if(sources.length<1||sources.length>3||sources.some(s=>s.authorName!=="St. Gregory of Nyssa"||
   s.workTitle!=="On the Soul and the Resurrection"||
   s.verificationStatus!=="REVIEWED_PRIMARY_TEXT_TRANSLATION"||
   s.metadata?.reviewedPilot!==true||s.metadata?.speakerVerified!==false||
   s.metadata?.exactQuoteAllowed!==false||typeof s.metadata?.excerpt!=="string"))
  errors.push("SOURCE_PROVENANCE_NOT_REVIEWED");
 for(const s of sources){if(typeof s.metadata?.excerpt==="string"&&longSourceCopy(answer,s.metadata.excerpt))
  errors.push("UNAPPROVED_VERBATIM_TEXT");}
 return [...new Set(errors)];
}

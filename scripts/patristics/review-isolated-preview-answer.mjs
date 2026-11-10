/** Conservative structural guard for preview answers from six opening-dialogue snippets.
 * NOT a theological proof or a general semantic truth evaluator.
 */
const unsupported=/(?:\b(?:apokatastasis|universal salvation|metempsychosis|pre.?existent souls|all souls are saved|the soul is mortal|macrina rejects resurrection|denies the resurrection)\b|апокатастаз[\p{L}]*|свеопшт[\p{L}]* спасењ[\p{L}]*|душа је смртн[\p{L}]*)/iu;
// 1 Thessalonians 4:13 distinguishes mourning with hope from mourning without hope.
// Reject categorical prohibition of grief, including a common misleading paraphrase
// of the historical English translation "duty of not being grieved".
const griefProhibition=/(?:\b(?:grief is not fitting|grieving is not fitting|sorrow is unbefitting|grieving is unbefitting|grief is forbidden|grief is prohibited|duty not to grieve|not to grieve for those|should not grieve for those|forbidden to grieve|never grieve|grief belongs only to)\b|забрањуј[\p{L}]*\s+да\s+се\s+тугуј[\p{L}]*|не\s+треба\s+жалит[\p{L}]*\s+он[\p{L}]*|не\s+сме\s+се\s+туговат[\p{L}]*|жалост\s+је\s+забрањен[\p{L}]*|zabranjuj[\p{L}]*\s+da\s+se\s+tuguj[\p{L}]*|ne\s+treba\s+žalit[\p{L}]*\s+on[\p{L}]*|ne\s+sme\s+se\s+tugovat[\p{L}]*|tuga\s+je\s+zabranjen[\p{L}]*)/iu;
// Detect recurrent Serbian translation mistakes in this narrow grief context.
// "Тужити" means to sue, not to mourn ("туговати").
// The source says "like a skilful driver"; it never describes an actual horse
// or cavalry. Prevent a model from expanding the comparison into invented imagery.
const inventedAnimalMetaphor=/(?:\b(?:wild horse|horses|horse)\b|коњиц[\p{L}]*|коњ[\p{L}]*|konjic[\p{L}]*|konj[\p{L}]*)/iu;
const serbianGriefGrammar=/(?:не\s+тужи\s+као\s+они|не\s+тужи\s+као\s+они\s+који|названа\s+учитељица(?=[,.\s]))/iu;
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
/** Narrow language-only repair before source/theology checks, never change claims. */
export function normalizePreviewAnswerText(answer,lang){
 if(lang!=="sr-Cyrl"||typeof answer!=="string")return answer;
 return answer
  .replace(/,\s*(?:на)?звана\s+Учитељица(?=[,.\s]|$)/giu,"")
  .replace(/не\s+тужи(?=\s+као)/giu,"не тугује")
  .replace(/разуман\s+говором/giu,"разумним говором");
}

export function previewQuestionLanguage(question){
 const q=String(question??"");
 if(/[\u0400-\u052F]/u.test(q))return "sr-Cyrl";
 if(/\b(?:kako|makrina|grigorija|vasilija|utešila|posle|smrti|zbog)\b/iu.test(q))return "sr-Latn";
 return "en";
}
function answerLanguageCorrect(answer,lang){
 const alpha=(String(answer).match(/\p{L}/gu)??[]).length;
 const cyr=(String(answer).match(/[\u0400-\u052F]/gu)??[]).length;
 if(alpha<120)return false;
 if(lang==="sr-Cyrl")return cyr/alpha>0.65;
 if(cyr/alpha>0.08)return false;
 if(lang==="sr-Latn")return /\b(?:je|su|nakon|posle|zbog|koja|makrina|grigorije|vasilija|tugu|žalost|reči)\b/iu.test(answer);
 return /\b(?:the|and|after|when|she|his|apostle|gregory)\b/iu.test(answer);
}
function answerIsRepeated(answer){
 const parts=String(answer).split(/\n\s*\n|\n/gu).map(s=>s.trim().replace(/\s+/gu," ")).filter(s=>s.length>=120);
 return new Set(parts).size!==parts.length;
}

export function reviewIsolatedPreviewAnswer(answer,sources,lang=""){
 const errors=[];
 if(typeof answer!=="string"||!answer.trim())errors.push("EMPTY_ANSWER");
 if(lang && !answerLanguageCorrect(answer,lang))errors.push("WRONG_OR_MIXED_ANSWER_LANGUAGE");
 if(answerIsRepeated(answer))errors.push("DUPLICATED_ANSWER_TEXT");
 if(!Array.isArray(sources)||sources.length<1||sources.length>3)errors.push("INVALID_EVIDENCE_COUNT");
 if(unsupported.test(answer))errors.push("UNSUPPORTED_HIGH_RISK_CLAIM");
 if(fabricatedReferences.test(answer))errors.push("UNVERIFIED_PATROLOGIA_REFERENCE");
 if(griefProhibition.test(answer))errors.push("MISREADS_APOSTOLIC_MOURNING_WITH_HOPE");
 if(serbianGriefGrammar.test(answer))errors.push("SERBIAN_GRIEF_TRANSLATION_ERROR");
 if(inventedAnimalMetaphor.test(answer))errors.push("INVENTED_SOURCE_METAPHOR");
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

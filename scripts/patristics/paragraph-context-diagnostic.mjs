/**
 * Contextual diagnostics only: group retrieved chunks by edition+source locator.
 * Never upgrades evidence labels, changes source rankings, or presumes that all
 * chunks in one paragraph have the same speaker/stance.
 */
const VALID=new Set(["TEXT_VERIFIED","UNREVIEWED","NEEDS_REVIEW"]);
export function analyzeParagraphContext({questionId,retrieved,evidence,catalog}){
 if(!questionId||!Array.isArray(retrieved)||!Array.isArray(evidence)||!Array.isArray(catalog))
  throw Error("Invalid paragraph context inputs");
 const evidenceForQuestion=evidence.filter(e=>e.questionId===questionId);
 if(!evidenceForQuestion.length)throw Error("No reference evidence for question");
 const catalogById=new Map(catalog.map(r=>[r.passageId,r]));
 const groupByKey=new Map();
 for(const hit of retrieved){
  const row=catalogById.get(hit.passageId);
  if(!row||row.locator!==hit.locator)throw Error("Ranked passage missing from catalog");
  const key=row.editionId+"|"+row.locator;
  if(!groupByKey.has(key))groupByKey.set(key,{editionId:row.editionId,locator:row.locator,firstRetrievedRank:hit.rank,hitPassageIds:[]});
  const group=groupByKey.get(key);
  group.firstRetrievedRank=Math.min(group.firstRetrievedRank,hit.rank);
  group.hitPassageIds.push(hit.passageId);
 }
 const groups=[...groupByKey.values()].map(group=>{
  const siblings=catalog.filter(r=>r.editionId===group.editionId&&r.locator===group.locator)
   .sort((a,b)=>a.ordinal-b.ordinal);
  const gold=evidenceForQuestion.filter(e=>e.editionId===group.editionId&&e.locator===group.locator);
  const directIds=new Set(gold.map(x=>x.passageId));
  const retrievedEvidence=group.hitPassageIds.filter(id=>directIds.has(id));
  const siblingEvidence=gold.filter(e=>!group.hitPassageIds.includes(e.passageId));
  const attributions=siblings.map(s=>({ordinal:s.ordinal,passageId:s.passageId,
    speaker:s.speakerName??null,statementKind:s.statementKind??null,
    attributionStatus:s.attributionStatus??"UNREVIEWED"}));
  const stanceKeys=new Set(attributions.map(a=>
    (a.speaker??"UNKNOWN")+"|"+(a.statementKind??"UNKNOWN")));
  const hasUnreviewed=attributions.some(a=>a.attributionStatus!=="TEXT_VERIFIED");
  return {...group,siblingCount:siblings.length,matchedExactIds:retrievedEvidence,
    unreturnedReferenceChunks:siblingEvidence.map(x=>({passageId:x.passageId,role:x.role,ordinal:siblings.find(s=>s.passageId===x.passageId)?.ordinal??null})),
    status:retrievedEvidence.length?"EXACT_REFERENCE_HIT":
     siblingEvidence.length?"SAME_PARAGRAPH_NOT_SAME_EVIDENCE":"UNLABELLED_PARAGRAPH",
    mixedSpeakerOrStatement:stanceKeys.size>1,
    unreviewedAttribution:hasUnreviewed,
    attributionByChunk:attributions,
    requiresHumanReview:siblingEvidence.length>0||hasUnreviewed||stanceKeys.size>1};
 }).sort((a,b)=>a.firstRetrievedRank-b.firstRetrievedRank);
 return {questionId,diagnosticOnly:true,
   exactHitCount:groups.reduce((n,g)=>n+g.matchedExactIds.length,0),
   nearParagraphCount:groups.filter(g=>g.status==="SAME_PARAGRAPH_NOT_SAME_EVIDENCE").length,
   contextGroups:groups};
}

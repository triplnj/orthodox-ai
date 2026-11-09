/**
 * Offline metrics for provisional source-checked patristic evidence.
 * Rank utility is independent of Neon/OpenAI and never turns an objection into
 * the author's accepted doctrine.
 */
export const KS=Object.freeze([3,5,10]);
export function relevantEvidence(questionId,items){
 const relevant=new Map();
 for(const x of items){
  if(x.questionId!==questionId)continue;
  const positive=x.role==="DIRECT_ANSWER"||x.role==="SUPPORTING_CONTEXT"||
    (x.role==="OBJECTION_NOT_DOCTRINE"&&questionId==="gregory-03");
  if(positive)relevant.set(x.passageId,x.role==="DIRECT_ANSWER"?2:1);
 }
 return relevant;
}
export function evaluateRankedList(hits,relevant){
 if(!Array.isArray(hits)||!(relevant instanceof Map)||relevant.size===0)
   throw Error("Nonempty ranked hits and provisional relevance are required");
 const seen=new Set();
 const rank=hits.map(x=>{
  if(!x||typeof x.passageId!=="string"||seen.has(x.passageId))
    throw Error("Repeated or invalid passage identity in retrieval results");
  seen.add(x.passageId);
  return relevant.get(x.passageId)??0;
 });
 const result={};
 for(const k of KS){
  const top=rank.slice(0,k);
  const found=top.filter(x=>x>0).length;
  const ideal=[...relevant.values()].sort((a,b)=>b-a).slice(0,k);
  const dcg=top.reduce((sum,rel,i)=>sum+(Math.pow(2,rel)-1)/Math.log2(i+2),0);
  const idcg=ideal.reduce((sum,rel,i)=>sum+(Math.pow(2,rel)-1)/Math.log2(i+2),0);
  result["hit@"+k]=Number(found>0);
  result["recall@"+k]=Number((found/relevant.size).toFixed(5));
  result["ndcg@"+k]=Number((idcg?dcg/idcg:0).toFixed(5));
 }
 const first=rank.findIndex(x=>x>0);
 result.reciprocalRank=first<0?0:Number((1/(first+1)).toFixed(5));
 result.firstRelevantRank=first<0?null:first+1;
 return result;
}
export function aggregateScores(questionRows,key){
 if(!Array.isArray(questionRows)||!questionRows.length)throw Error("No scored questions");
 const cols=["hit@3","hit@5","hit@10","recall@3","recall@5","recall@10",
   "ndcg@3","ndcg@5","ndcg@10","reciprocalRank"];
 const out={};
 for(const c of cols){
  out[c]=Number((questionRows.reduce((n,r)=>n+r[key][c],0)/questionRows.length).toFixed(5));
 }
 return out;
}

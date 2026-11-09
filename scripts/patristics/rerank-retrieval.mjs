/**
 * Deterministic, offline, English-first reranker for STAGING QA only.
 * Candidate pool must come from guarded vector retrieval. Neither similarity
 * nor lexical matching establishes speaker attribution or accepted doctrine.
 */
const STOP=new Set(("a an and are as at be by can does for from how in into is it its of on or " +
 "our the their these this to was were what when where which who why with through about " +
 "saint st great first homily book work interpretation interpret discuss says say " +
 "gregory nyssa basil john chrysostom macrina").split(/\s+/));
const STEMS=new Map([
 ["scriptures","scripture"],["biblical","bible"],["written","write"],
 ["writing","write"],["writings","write"],["creation","creat"],
 ["created","creat"],["creating","creat"],["creator","creat"],
 ["beginning","begin"],["began","begin"],["resurrection","resurrect"],
 ["resurrected","resurrect"],["souls","soul"],["gospels","gospel"],
 ["evangelists","evangelist"],["heavens","heaven"]
]);
export function queryTerms(question){
 if(typeof question!=="string"||question.length>2000)throw Error("Invalid English question");
 return [...new Set((question.toLowerCase().match(/[a-z]+/g)??[])
  .map(x=>STEMS.get(x)??x)
  .filter(x=>x.length>=4&&!STOP.has(x)))];
}
function words(text){
 return new Set((String(text??"").toLowerCase().match(/[a-z]+/g)??[])
   .map(x=>STEMS.get(x)??x));
}
function paratext(text){
 const s=String(text??"").trim();
 if(s.length<75)return true;
 const first=s.slice(0,140);
 return /^(?:homily\s+[ivxlcdm\d]+\b|title\s*:|contents\s*:|preface\s*$|chapter\s+[ivxlcdm\d]+\s*$)/i.test(first)&&s.length<220;
}
export function rerankCandidates(question,hits,{limit=5}={}){
 if(!Array.isArray(hits)||!Number.isInteger(limit)||limit<1||limit>20)
   throw Error("Invalid retrieval candidates");
 const terms=queryTerms(question);
 return hits.map((hit,index)=>{
   const similarity=Number(hit.similarity);
   if(!Number.isFinite(similarity)||typeof hit.content!=="string")
     throw Error("Invalid retrieval hit");
   const contentWords=words(hit.content);
   const overlap=terms.length===0?0:terms.filter(x=>contentWords.has(x)).length/terms.length;
   const shortPenalty=paratext(hit.content)?0.18:0;
   // Modest lexical signal; cap prevents long passages dominating via length.
   const score=similarity+0.16*overlap-shortPenalty;
   return {...hit,rerankScore:Number(score.toFixed(6)),
      lexicalCoverage:Number(overlap.toFixed(4)),paratextPenalty:shortPenalty,
      originalRank:index+1};
 }).sort((a,b)=>b.rerankScore-a.rerankScore||
   b.similarity-a.similarity||
   String(a.passageId??"").localeCompare(String(b.passageId??"")))
 .slice(0,limit);
}

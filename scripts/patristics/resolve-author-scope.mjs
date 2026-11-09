/**
 * Shadow-only, deterministic source-author resolver. No DB, embedding, or chat.
 * A named author must match a whole phrase from an audited alias catalogue.
 * Incomplete/ambiguous names never cause a switch to another saint.
 */
const ALIASES=Object.freeze({
 "St. Athanasius of Alexandria":["st athanasius of alexandria","saint athanasius of alexandria","athanasius of alexandria","athanasius the great","sveti atanásije veliki","sveti atanasije veliki","свети атанасије велики","свети атанасије александријски"],
 "St. Basil the Great":["st basil the great","saint basil the great","basil the great","saint basil of caesarea","sveti vasilije veliki","свети василије велики"],
 "St. Cyril of Jerusalem":["st cyril of jerusalem","saint cyril of jerusalem","cyril of jerusalem","sveti kirilo jerusalimski","свети кирило јерусалимски","свети кирил јерусалимски"],
 "St. Gregory of Nyssa":["st gregory of nyssa","saint gregory of nyssa","gregory of nyssa","gregory nyssa","sveti grigorije niski","свети григорије ниски"],
 "St. John Chrysostom":["st john chrysostom","saint john chrysostom","john chrysostom","chrysostom","sveti jovan zlatousti","свети јован златоусти"]
});
// Short names without a title are safe only when the surname is unique or
// uniquely given in a fixed, audited corpus. Never route "Cyril" or "Gregory".
const SHORT=Object.freeze({
 "St. Athanasius of Alexandria":["athanasius"],
 "St. Basil the Great":["basil"],
 "St. John Chrysostom":["chrysostom"]
});
const COMPARATIVE=/(?:\bcompare\b|\bcompared\b|\bversus\b|\bvs\.?\b|\bdifference(?:s)? between\b|\bcontrast\b|\bboth\b|\bbetween\b|упореди|пореди|упоред|разлика|поређ|између)/iu;
const NAME_HINT=/(?:\b(?:saint|st|father)\b|\b(?:athanasius|basil|cyril|gregory|john|chrysostom|maximus|augustine|nicholas|isaac|justin)\b|свети|св\.|свештени|атанасије|василије|кирил|григорије|јован|максим|исак|августин|николај|златоусти)/iu;
const normalize=s=>String(s).normalize("NFKC").toLocaleLowerCase("en").replace(/\bst\.\s+/g,"st ").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const boundary=(s,term)=>(" "+s+" ").includes(" "+term+" ");
export function resolveAuthorScope(question,catalog){
 if(typeof question!=="string"||!question.trim()||question.length>2000)throw Error("Invalid author-routing question");
 if(!Array.isArray(catalog)||!catalog.length)throw Error("No explicitly provided staged author catalog");
 const records=catalog.filter(x=>typeof x.canonicalName==="string" &&
   typeof x.id==="string" && Number(x.indexed)>0);
 const byName=new Map();
 for(const r of records){
  if(!byName.has(r.canonicalName))byName.set(r.canonicalName,new Set());
  byName.get(r.canonicalName).add(r.id);
 }
 const normalized=normalize(question);
 const matches=[];
 for(const [canonicalName,aliases] of Object.entries(ALIASES)){
  const phrases=[...aliases,...(SHORT[canonicalName]??[])].map(normalize);
  if(phrases.some(alias=>boundary(normalized,alias)))matches.push(canonicalName);
 }
 const comparison=COMPARATIVE.test(question);
 const named=NAME_HINT.test(question);
 if(matches.length>2 || (comparison&&matches.length!==2))
  return {status:"REVIEW_REQUIRED",scope:"NO_AUTOMATIC_FILTER",authors:matches,reason:"COMPARISON_SCOPE_UNSUPPORTED",comparison};
 if(matches.length===0)
  return {status:named?"UNRESOLVED_NAMED_AUTHOR":"NO_EXPLICIT_AUTHOR",scope:named?"NO_AUTOMATIC_FILTER":"GLOBAL",
   authors:[],reason:named?"AUTHOR_NOT_IN_VERIFIED_ALIAS_CATALOG":"AUTHOR_NOT_SPECIFIED",comparison};
 const duplicates=matches.filter(x=>byName.get(x)?.size!==1);
 if(duplicates.length)
  return {status:"REVIEW_REQUIRED",scope:"NO_AUTOMATIC_FILTER",authors:matches,reason:"MISSING_OR_DUPLICATE_INDEXED_AUTHOR_RECORD",comparison,duplicates};
 return {status:"EXACT_CATALOG_MATCH",scope:comparison?"MULTI_AUTHOR":"SINGLE_AUTHOR",
  authors:matches,authorIds:matches.map(n=>[...byName.get(n)][0]),
  reason:"EXPLICIT_AUTHOR_WHOLE_PHRASE_MATCH",comparison};
}
export function stagingAuthorFilterDecision(route){
 if(route?.status!=="EXACT_CATALOG_MATCH")return {allowed:false,reason:route?.reason??"INVALID_ROUTE"};
 return {allowed:true,scope:route.scope,authorNames:route.authors};
}

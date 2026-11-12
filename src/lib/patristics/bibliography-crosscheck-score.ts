export type CrosscheckedClaim={id:string;author:string;work:string;role:string;relation:string;parentWork?:string;sourceIds:string[]};
type Prediction={author:string;work:string;role:string;relation:string;parentWork?:string};
const norm=(v:string)=>v.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const key=(v:{author:string;work:string})=>norm(v.author)+"|"+norm(v.work);
export function evaluateCrosscheckedClaims(
 truth:CrosscheckedClaim[],predictions:Prediction[],
) {
 const actual=new Map(truth.map(x=>[key(x),x]));
 const distinct=new Map(predictions.map(x=>[key(x)+"|"+x.role+"|"+x.relation,x]));
 let matched=0,wrongRole=0,wrongRelation=0,unsupported=0;
 for (const p of distinct.values()){
   const evidence=actual.get(key(p));
   if(!evidence){unsupported++;continue;}
   if(evidence.role!==p.role){wrongRole++;continue;}
   if(evidence.relation!==p.relation || (evidence.parentWork??"")!==(p.parentWork??"")){wrongRelation++;continue;}
   matched++;
 }
 const attempted=distinct.size;
 return {
   evaluatedPredictions:attempted,exactSupportedClaims:matched,
   wrongRoles:wrongRole,wrongWorkRelationships:wrongRelation,
   unsupportedClaims:unsupported,precision:attempted?matched/attempted:null,
   recall:truth.length?matched/truth.length:null,
 };
}

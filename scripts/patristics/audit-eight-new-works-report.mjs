/**
 * Offline audit of the archived eight-question NEW WORK retrieval benchmark.
 * Does not modify ranking, evidence labels, sources, or Neon.
 *
 * node scripts/patristics/audit-eight-new-works-report.mjs path/to/new-works.eight-question-qa.json
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const SCOPES=["all-authors","expected-author"];
const METHODS=["baseline","reranked"];
export function auditEightNewWorks(report){
 if(report?.status!=="NEW_WORK_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION"||
    report.branchId!=="br-spring-frost-assfzje6"||
    report.questionCount!==8||report.sourcePassages!==10||
    report.totalPassages!==295||report.indexedPassages!==291||
    !Array.isArray(report.questions)||report.questions.length!==8)
  throw Error("Invalid archived new-work benchmark: do not reinterpret changed runs");
 const ids=new Set(),rows=[];
 for(const q of report.questions){
  if(!q.questionId||ids.has(q.questionId)||!q.author||!q.targetPassageId||!q.targetLocator)
   throw Error("Malformed or duplicate eight-question record");
  ids.add(q.questionId);
  const record={questionId:q.questionId,author:q.author,targetLocator:q.targetLocator,
    firstRelevantRank:{},authorOfTopHit:{},unexpectedTopAuthor:{},authorPresentInTop3:{},targetInTop10:{}};
  for(const scope of SCOPES){
   record.firstRelevantRank[scope]={};record.authorOfTopHit[scope]={};
   record.unexpectedTopAuthor[scope]={};record.authorPresentInTop3[scope]={};
   record.targetInTop10[scope]={};
   for(const method of METHODS){
    const group=q.scopes?.[scope];
    const hits=group?.[method+"Top10"];
    const scores=group?.[method];
    if(!Array.isArray(hits)||!hits.length||hits.length>10||!scores)
     throw Error("Missing ranking data: "+q.questionId);
    if(hits.some((x,i)=>x.rank!==i+1||!x.passageId||!x.author||
      x.relevant!==(x.passageId===q.targetPassageId)))
     throw Error("Invalid source provenance/relevance: "+q.questionId);
    const index=hits.findIndex(x=>x.passageId===q.targetPassageId);
    const first=index===-1?null:index+1;
    if(scores.firstRelevantRank!==first||scores["hit@10"]!==(first===null?0:1))
     throw Error("Metrics disagree with frozen source IDs: "+q.questionId);
    record.firstRelevantRank[scope][method]=first;
    record.authorOfTopHit[scope][method]=hits[0].author;
    record.unexpectedTopAuthor[scope][method]=hits[0].author!==q.author;
    record.authorPresentInTop3[scope][method]=hits.slice(0,3).some(x=>x.author===q.author);
    record.targetInTop10[scope][method]=first!==null;
   }
  }
  rows.push(record);
 }
 const flags={
  originalGlobalMisses:rows.filter(x=>x.firstRelevantRank["all-authors"].baseline===null).map(x=>x.questionId),
  globalRerankDemotions:rows.filter(x=>{
   const b=x.firstRelevantRank["all-authors"].baseline,r=x.firstRelevantRank["all-authors"].reranked;
   return b!==null&&(r===null||r>b);
  }).map(x=>x.questionId),
  globalWrongAuthorAtRank1:rows.filter(x=>x.unexpectedTopAuthor["all-authors"].baseline).map(x=>x.questionId),
  globalAuthorRescueByFilter:rows.filter(x=>x.firstRelevantRank["all-authors"].baseline===null&&
    x.firstRelevantRank["expected-author"].baseline!==null).map(x=>x.questionId)
 };
 return {status:"SOURCE_RANKING_DIAGNOSTIC_ONLY",originalReportStatus:report.status,
  questions:rows,flags,
  caveats:[
   "The single annotated target for Athanasius question 02 (§3) may be too narrow: §4 directly discusses beginning with creation. Editorial re-review only; do not change frozen results.",
   "A top-ranked same-author section is not automatically exact evidence. A correct evidence location is not a verified quotation or theological endorsement.",
   "Do not infer author-identification performance from expected-author filtered retrieval: the expected author was provided by the test."
  ]};
}
export function renderEightAuditMarkdown(report){
 const audit=auditEightNewWorks(report);
 const sum=report.summary;
 const pct=x=>(100*x).toFixed(1)+"%";
 const lines=[
  "# Eight new-work retrieval questions — frozen staging audit",
  "",
  "**Measured source retrieval only. No generated answers were evaluated for citation fidelity or doctrinal accuracy.**",
  "",
  "| Scope | Ranker | Hit@10 | nDCG@10 | MRR |",
  "|---|---|---:|---:|---:|"
 ];
 for(const scope of SCOPES)for(const method of METHODS){
  const s=sum[scope]?.[method];if(!s)throw Error("Missing published summary");
  lines.push("| "+scope+" | "+method+" | "+pct(s["hit@10"])+" | "+pct(s["ndcg@10"])+" | "+pct(s.reciprocalRank)+" |");
 }
 lines.push("","## Question-level passage ranks","","| Question | Global baseline | Global reranked | Expected-author baseline | Expected-author reranked |","|---|---:|---:|---:|---:|");
 const fmt=x=>x===null?"not in top 10":String(x);
 for(const q of audit.questions)
  lines.push("| "+q.questionId+" | "+fmt(q.firstRelevantRank["all-authors"].baseline)+
   " | "+fmt(q.firstRelevantRank["all-authors"].reranked)+
   " | "+fmt(q.firstRelevantRank["expected-author"].baseline)+
   " | "+fmt(q.firstRelevantRank["expected-author"].reranked)+" |");
 lines.push("","## Flags","");
 for(const [key,ids] of Object.entries(audit.flags))
  lines.push("- "+key+": "+(ids.length?ids.join(", "):"none"));
 lines.push("","## Interpretation",...audit.caveats.map(x=>"- "+x),"");
 return lines.join("\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const input=process.argv[2],format=process.argv[3]??"markdown";
  if(!input||!["markdown","json"].includes(format))throw Error("Usage: audit-eight-new-works-report.mjs <archive-report.json> [markdown|json]");
  const report=JSON.parse(readFileSync(input,"utf8"));
  process.stdout.write(format==="json"?JSON.stringify(auditEightNewWorks(report),null,2)+"\n":renderEightAuditMarkdown(report));
 }catch(e){process.stderr.write("EIGHT_WORK_AUDIT_FAILED: "+e.message+"\n");process.exitCode=1;}
}

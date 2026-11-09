/**
 * No-network audit of one already-computed evidence retrieval report.
 * Usage: node scripts/patristics/audit-30-evidence-report.mjs report.json
 *
 * Produces an actionable Markdown quality audit for English-first source
 * retrieval. No API calls, no model judgement, no changes to production.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const SCOPES=["all-authors","expected-author"];
const METRICS=["hit@3","hit@5","hit@10","recall@3","recall@5","recall@10","ndcg@10","reciprocalRank"];
const percent=x=>(100*x).toFixed(1)+"%";
export function auditReport(report){
 if(report?.status!=="PROVISIONAL_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION"||
    report.questionCount!==30||!Array.isArray(report.questions)||report.questions.length!==30)
  throw Error("Invalid or incomplete provisional English QA report");
 const lines=[
  "# OrthodoxAI — English evidence-retrieval audit",
  "",
  "Scope: 30 source-checked questions on isolated Neon staging. The labels are **provisional** and are not independently certified theological ground truth.",
  "",
  "## Aggregate performance (unchanged vector baseline vs current reranker)",
  "",
  "| Scope | Metric | Vector baseline | Current reranker | Change |",
  "|---|---|---:|---:|---:|"
 ];
 for(const scope of SCOPES){
  const x=report.summary?.[scope];
  if(!x?.baseline||!x?.reranked)throw Error("Missing benchmark scope "+scope);
  for(const metric of METRICS){
   const a=x.baseline[metric],b=x.reranked[metric];
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||a>1||b>1)
    throw Error("Invalid metric "+scope+" "+metric);
   lines.push("| "+scope+" | "+metric+" | "+percent(a)+" | "+percent(b)+" | "+(b-a>=0?"+":"")+percent(b-a)+" |");
  }
 }
 const problems=[];
 for(const q of report.questions){
  if(!q.questionId||!q.question||!q.searches)throw Error("Malformed question");
  for(const scope of SCOPES){
   const a=q.searches[scope];
   if(!a?.baseline||!a?.reranked||!Array.isArray(a.rerankedTop10))
    throw Error("Missing detail "+q.questionId+" "+scope);
   const relevant=a.rerankedTop10.filter(x=>x.role==="DIRECT_ANSWER"||x.role==="SUPPORTING_CONTEXT"||
     (q.questionId==="gregory-03"&&x.role==="OBJECTION_NOT_DOCTRINE"));
   const errorType=a.reranked["hit@10"]===0?"NO_EVIDENCE_TOP10":
     a.reranked["hit@3"]===0?"EVIDENCE_BELOW_TOP3":null;
   if(errorType||a.reranked["ndcg@10"]<a.baseline["ndcg@10"]-0.0001){
    problems.push({
      id:q.questionId,scope,question:q.question,errorType:errorType??"RERANK_REGRESSION",
      baselineHit3:a.baseline["hit@3"],rerankedHit3:a.reranked["hit@3"],
      baselineNdcg:a.baseline["ndcg@10"],rerankedNdcg:a.reranked["ndcg@10"],
      firstEvidence:relevant[0]?.locator??"Not in top ten",
      firstEvidenceRank:relevant[0]?.rank??null,
      topCandidate:a.rerankedTop10[0]?.locator??"None",
      topCandidateRole:a.rerankedTop10[0]?.role??"NOT_IN_REFERENCE_SET"
    });
   }
  }
 }
 problems.sort((a,b)=>{
  const order={NO_EVIDENCE_TOP10:0,EVIDENCE_BELOW_TOP3:1,RERANK_REGRESSION:2};
  return (order[a.errorType]-order[b.errorType])||
    a.scope.localeCompare(b.scope)||a.id.localeCompare(b.id);
 });
 lines.push("","## Prioritized questions for investigation","",
 "| Priority | Scope | Question ID | Top retrieved | First positive evidence | nDCG@10, vector → reranked |",
 "|---|---|---|---|---|---|");
 if(!problems.length)lines.push("| None flagged | — | — | — | — | — |");
 for(const p of problems){
  lines.push("| "+p.errorType+" | "+p.scope+" | "+p.id+" | "+p.topCandidate+
   " ("+p.topCandidateRole+") | "+p.firstEvidence+
   (p.firstEvidenceRank?" (rank "+p.firstEvidenceRank+")":"")+" | "+
   p.baselineNdcg.toFixed(3)+" → "+p.rerankedNdcg.toFixed(3)+" |");
 }
 lines.push("","## Interpretation limits","",
 "- A missing positive evidence ID is a **retrieval failure relative to this provisional set**, not proof that the returned source is theologically irrelevant.",
 "- A source-associated objection must never be presented as a Church Father's accepted teaching.",
 "- Correct author identification is not evidence-level relevance.",
 "- Do not optimize against these 30 questions alone; use an independent holdout set before promotion.",
 "");
 return {markdown:lines.join("\n"),problemCount:problems.length,problems};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const file=process.argv[2];
  if(!file)throw Error("Usage: audit-30-evidence-report.mjs <report.json>");
  process.stdout.write(auditReport(JSON.parse(readFileSync(file,"utf8"))).markdown+"\n");
 }catch(e){process.stderr.write("AUDIT_FAILED: "+e.message+"\n");process.exitCode=1;}
}

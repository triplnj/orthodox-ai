import test from "node:test";
import assert from "node:assert/strict";
import {auditReport} from "../scripts/patristics/audit-30-evidence-report.mjs";
const metric={};
for(const k of ["hit@3","hit@5","hit@10","recall@3","recall@5","recall@10","ndcg@10","reciprocalRank"])metric[k]=0;
const good={...metric,"hit@3":1,"hit@5":1,"hit@10":1,"ndcg@10":0.9};
function fixture(){
 return {status:"PROVISIONAL_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION",
  questionCount:30,
  summary:{"all-authors":{baseline:good,reranked:metric},
    "expected-author":{baseline:good,reranked:good}},
  questions:Array.from({length:30},(_,i)=>({
   questionId:"test-"+i,question:"Sample question?",
   searches:{"all-authors":{baseline:good,reranked:metric,
      rerankedTop10:[{rank:1,locator:"Source paragraph 001",passageId:"noise",role:null}]},
     "expected-author":{baseline:good,reranked:good,
      rerankedTop10:[{rank:1,locator:"Source paragraph 002",passageId:"direct",role:"DIRECT_ANSWER"}]}}
  }))};
}
test("audit highlights absent sources and presents raw baseline vs reranking",()=>{
 const audit=auditReport(fixture());
 assert.equal(audit.problemCount,30);
 assert.equal(audit.problems[0].errorType,"NO_EVIDENCE_TOP10");
 assert.match(audit.markdown,/Vector baseline/);
 assert.match(audit.markdown,/NOT_IN_REFERENCE_SET/);
 assert.match(audit.markdown,/not independently certified theological ground truth/);
});
test("audit refuses malformed and incomplete reports",()=>{
 assert.throws(()=>auditReport({}),/Invalid/);
 const bad=fixture();bad.summary["all-authors"].reranked["recall@3"]=NaN;
 assert.throws(()=>auditReport(bad),/Invalid metric/);
});

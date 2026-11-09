import test from "node:test";
import assert from "node:assert/strict";
import {auditEightNewWorks,renderEightAuditMarkdown} from "../scripts/patristics/audit-eight-new-works-report.mjs";
const target="passage_target";
function ranked(rank,wrongAuthor=false){
 const author=wrongAuthor?"St. Basil the Great":"St. Athanasius of Alexandria";
 const result=[{rank:1,passageId:rank===1?target:"passage_context",author,locator:"Chapter I, §4",relevant:rank===1}];
 if(rank===2)result.push({rank:2,passageId:target,author:"St. Athanasius of Alexandria",locator:"Chapter I, §3",relevant:true});
 return result;
}
function report(){
 const rows=Array.from({length:8},(_,i)=>{
  const qid=i===0?"athanasius-inc-02":"q"+i,miss=i===0;
  const globalBaseline=miss?ranked(null,true):ranked(1);
  const globalReranked=miss?ranked(null,true):i===1?ranked(2):ranked(1);
  const filteredBaseline=miss?ranked(2):ranked(1);
  const filteredReranked=miss?ranked(2):i===1?ranked(2):ranked(1);
  const block=(base,rerank)=>({
    baselineTop10:base,rerankedTop10:rerank,
    baseline:{firstRelevantRank:base.find(x=>x.relevant)?.rank??null,"hit@10":Number(base.some(x=>x.relevant))},
    reranked:{firstRelevantRank:rerank.find(x=>x.relevant)?.rank??null,"hit@10":Number(rerank.some(x=>x.relevant))}
  });
  return {questionId:qid,author:"St. Athanasius of Alexandria",targetPassageId:target,
    targetLocator:"Chapter I, §3",scopes:{"all-authors":block(globalBaseline,globalReranked),
      "expected-author":block(filteredBaseline,filteredReranked)}};
 });
 return {status:"NEW_WORK_RETRIEVAL_QA_NOT_THEOLOGICAL_CERTIFICATION",
  branchId:"br-spring-frost-assfzje6",questionCount:8,sourcePassages:10,
  totalPassages:295,indexedPassages:291,
  summary:Object.fromEntries(["all-authors","expected-author"].map(scope=>[scope,Object.fromEntries(
   ["baseline","reranked"].map(method=>[method,{"hit@10":0.875,"ndcg@10":0.8,reciprocalRank:0.7}]))])),
  questions:rows};
}
test("flags global miss and author-filter rescue without inventing a source hit",()=>{
 const audit=auditEightNewWorks(report());
 assert.deepEqual(audit.flags.originalGlobalMisses,["athanasius-inc-02"]);
 assert.deepEqual(audit.flags.globalAuthorRescueByFilter,["athanasius-inc-02"]);
 assert.deepEqual(audit.flags.globalRerankDemotions,["q1"]);
 assert.deepEqual(audit.flags.globalWrongAuthorAtRank1,["athanasius-inc-02"]);
 assert.match(renderEightAuditMarkdown(report()),/not in top 10/);
});
test("rejects corrupted source attribution, ranking and summary scope",()=>{
 const a=report();a.questions[0].scopes["all-authors"].baselineTop10[0].relevant=true;
 assert.throws(()=>auditEightNewWorks(a),/provenance/);
 const b=report();b.questions[1].scopes["all-authors"].baseline["hit@10"]=0;
 assert.throws(()=>auditEightNewWorks(b),/Metrics disagree/);
 const c=report();c.totalPassages=300;
 assert.throws(()=>auditEightNewWorks(c),/Invalid archived/);
});

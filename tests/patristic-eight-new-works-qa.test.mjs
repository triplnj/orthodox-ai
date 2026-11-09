import test from "node:test";
import assert from "node:assert/strict";
import {prepareSourceBatch} from "../scripts/patristics/prepare-source-batch.mjs";
import {validateNewWorksBenchmark} from "../scripts/patristics/evaluate-eight-new-works-staging.mjs";
import {readFileSync} from "node:fs";
const plan=JSON.parse(readFileSync("tests/fixtures/patristic-new-works-8-question-plan.json","utf8"));
const works=[
 {author:"St. Athanasius of Alexandria",title:"On the Incarnation of the Word, Chapter 1",
  locators:["Chapter I, §1","Chapter I, §2","Chapter I, §3","Chapter I, §4"]},
 {author:"St. Cyril of Jerusalem",title:"Catechetical Lecture 1",
  locators:Array.from({length:6},(_,i)=>"Catechetical Lecture I, §"+(i+1))}
];
const manifest={schemaVersion:1,works:works.map((w,i)=>({
 author:w.author,title:w.title,editionTitle:"Historic English translation "+i,
 corpus:"CURATED_OTHER",language:"English",translator:"Historic",
 sourceUrl:"https://en.wikisource.org/wiki/Test"+i,
 licenseNote:"Nineteenth-century public domain historic translation used for staging-only tests.",
 rightsReviewed:true,
 paragraphs:w.locators.map(locator=>({locator,text:"Test-only source passage on "+locator+" and the nature of Christian teaching."}))
}))};
const prep=prepareSourceBatch(manifest);
const report={status:"TWO_NEW_WORKS_STAGED_UNREVIEWED",
 branchId:"br-spring-frost-assfzje6",counts:{passages:10},
 editionIds:prep.works.map(w=>w.editionId)};
const env={LIBRARY_STAGING_BRANCH_ID:report.branchId,
 LIBRARY_STAGING_DB_URL:"postgresql://user:mock@ep-test.eu-central-1.aws.neon.tech/neondb",
 OPENAI_API_KEY:"test-only"};
test("eight new questions resolve unambiguously to ten new-work source sections",()=>{
 const result=validateNewWorksBenchmark(plan,manifest,report,env);
 assert.equal(result.targets.length,8);
 assert.equal(result.prepared.counts.passages,10);
 assert.equal(new Set(result.targets.map(x=>x.id)).size,8);
 assert.ok(result.targets.every(x=>x.passageId.startsWith("passage_")));
 assert.ok(result.targets.every(x=>x.sourceSha256.length===64));
});
test("reject swapped source identity and wrong protected staging branch",()=>{
 const wrong={...report,editionIds:[...report.editionIds.slice(1),"edition_00000000000000000000000000000000"]};
 assert.throws(()=>validateNewWorksBenchmark(plan,manifest,wrong,env),/source identity/);
 assert.throws(()=>validateNewWorksBenchmark(plan,manifest,report,{...env,LIBRARY_STAGING_BRANCH_ID:"br-flat-mode-as1mxdf8"}),/missing/);
});
test("source passage ID cannot be injected by unreviewed plan",()=>{
 const modified=structuredClone(plan);
 modified.questions[0].sourcePassageId="passage_fake";
 assert.throws(()=>validateNewWorksBenchmark(modified,manifest,report,env),/not pinned/);
});

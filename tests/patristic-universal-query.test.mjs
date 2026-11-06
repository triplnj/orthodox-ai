import test from "node:test";
import assert from "node:assert/strict";
import {planUniversalQuery} from "../scripts/patristics/universal-query.mjs";

test("Serbian Cyrillic bibliography question routes to catalog",()=>{
 const q=planUniversalQuery("Која дела је написао Свети Јустин Поповић?");
 assert.equal(q.intent,"BIBLIOGRAPHY");
 assert.equal(q.sourceKinds[0],"CATALOG_METADATA");
 assert.equal(q.allowUnverifiedDirectQuotes,false);
});
test("Serbian Cyrillic teaching question routes independently of author",()=>{
 const q=planUniversalQuery("Шта Свети Максим Исповедник учи о вољи?");
 assert.equal(q.intent,"DOCTRINAL_EXPLANATION");
 assert.equal(q.scope,"ALL_STAGED");
});
test("English compare question requires cross-source review",()=>{
 const q=planUniversalQuery("Compare the teachings of Maximus and Gregory on resurrection");
 assert.equal(q.intent,"COMPARATIVE_TEACHING");
 assert.equal(q.requiresCrossSourceReview,true);
});
test("Scripture commentary receives suitable source priority",()=>{
 const q=planUniversalQuery("How does Chrysostom interpret Romans 8:1?");
 assert.equal(q.intent,"SCRIPTURE_COMMENTARY");
 assert.equal(q.sourceKinds[0],"SCRIPTURE_REFERENCE");
});
test("Unsupported claims and direct quotes are never enabled by routing",()=>{
 const questions=["Who was Basil the Great?","Пронађи цитат о покајању","How is fasting practiced in Orthodox tradition?","Unusual question"];
 for(const text of questions){
  const q=planUniversalQuery(text);
  assert.equal(q.allowUnverifiedDirectQuotes,false);
  assert.equal(q.allowUnsupportedAnswer,false);
 }
});
test("Rejects empty, huge or non-staging requests",()=>{
 assert.throws(()=>planUniversalQuery(""),/Question/);
 assert.throws(()=>planUniversalQuery("a".repeat(2001)),/Question/);
 assert.throws(()=>planUniversalQuery("test",{scope:"PRODUCTION"}),/staging/);
});

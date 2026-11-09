import test from "node:test";
import assert from "node:assert/strict";
import {rankSourcePassage} from "../scripts/patristics/rank-staging-source-evidence.mjs";
test("incarnation matches source phrases, not only an English label",()=>{
 const p=rankSourcePassage({content:"the Word ... manifested to us in a human body for our salvation",topicTerms:"incarnation"});
 assert.ok(p.score>0);assert.equal(p.matchedCues[0].concept,"incarnation");
});
test("unrelated source and unrelated doctrinal concept have zero score",()=>{
 const p=rankSourcePassage({content:"He preached the Gospel and discussed the evangelists",topicTerms:"incarnation"});
 assert.equal(p.score,0);
 const q=rankSourcePassage({content:"it describes the creation of the universe",topicTerms:"prayer"});
 assert.equal(q.score,0);
});
test("literal support is still required for baptism",()=>{
 const a=rankSourcePassage({content:"the grace of baptism",topicTerms:"baptism"});
 assert.ok(a.score>0);
 const b=rankSourcePassage({content:"first homily about creation",topicTerms:"baptism"});
 assert.equal(b.score,0);
});

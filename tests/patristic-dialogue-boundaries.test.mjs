import test from "node:test";
import assert from "node:assert/strict";
import {detectBoundaryCandidates} from "../scripts/patristics/flag-dialogue-boundaries.mjs";

test("marks narrator-to-speaker transition for review, never auto-attribution",()=>{
 const [result]=detectBoundaryCandidates([{
  locator:"Source paragraph 086",ordinal:0,
  content:"When I had finished, the Teacher thus replied, You have attacked the doctrines."
 }]);
 assert.equal(result.status,"CANDIDATE_ONLY");
 assert.equal(result.flags[0].marker,"TEACHER_REPLIED");
 assert.equal(result.flags[0].speaker,"UNDETERMINED");
 assert.equal(result.flags[0].requiresHumanReview,true);
});
test("flags reported unbelievers separately from narrator",()=>{
 const [result]=detectBoundaryCandidates([{
  locator:"Source paragraph 085",ordinal:0,
  content:"Let me say something else also from among the objections made by unbelievers. No part, they urge."
 }]);
 assert.deepEqual(result.flags.map(f=>f.marker),["REPORTED_OPPONENT","REPORTED_OPPONENT"]);
});
test("does not invent boundaries where there are none",()=>{
 assert.deepEqual(detectBoundaryCandidates([{
  locator:"Source paragraph 084",ordinal:2,
  content:"How could I recognize myself when the body has changed?"
 }]),[]);
});
test("requires source location and ordered chunks",()=>{
 assert.throws(()=>detectBoundaryCandidates([{content:"she replied"}]),/needs content/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {analyzeParagraphContext} from "../scripts/patristics/paragraph-context-diagnostic.mjs";
const evidence=[{questionId:"q",editionId:"e",locator:"Source paragraph 086",passageId:"answer",role:"DIRECT_ANSWER"}];
const catalog=[
 {passageId:"preface",editionId:"e",locator:"Source paragraph 086",ordinal:0,
  statementKind:null,speakerName:null,attributionStatus:"UNREVIEWED"},
 {passageId:"answer",editionId:"e",locator:"Source paragraph 086",ordinal:1,
  statementKind:"ANSWER",speakerName:"Macrina",attributionStatus:"TEXT_VERIFIED"},
 {passageId:"objection",editionId:"e",locator:"Source paragraph 085",ordinal:0,
  statementKind:"OBJECTION",speakerName:"Gregory of Nyssa",attributionStatus:"TEXT_VERIFIED"}
];
test("retrieving a different chunk of a gold paragraph never becomes an exact hit",()=>{
 const result=analyzeParagraphContext({questionId:"q",evidence,catalog,
  retrieved:[{rank:1,passageId:"preface",locator:"Source paragraph 086"}]});
 assert.equal(result.exactHitCount,0);
 assert.equal(result.nearParagraphCount,1);
 assert.equal(result.contextGroups[0].status,"SAME_PARAGRAPH_NOT_SAME_EVIDENCE");
 assert.deepEqual(result.contextGroups[0].unreturnedReferenceChunks.map(x=>x.passageId),["answer"]);
 assert.equal(result.contextGroups[0].mixedSpeakerOrStatement,true);
 assert.equal(result.contextGroups[0].requiresHumanReview,true);
});
test("an explicitly retrieved reference remains an exact reference hit",()=>{
 const result=analyzeParagraphContext({questionId:"q",evidence,catalog,
  retrieved:[{rank:3,passageId:"answer",locator:"Source paragraph 086"}]});
 assert.equal(result.exactHitCount,1);
 assert.equal(result.nearParagraphCount,0);
});
test("objection in a different paragraph is not promoted to doctrinal evidence",()=>{
 const result=analyzeParagraphContext({questionId:"q",evidence,catalog,
  retrieved:[{rank:1,passageId:"objection",locator:"Source paragraph 085"}]});
 assert.equal(result.exactHitCount,0);
 assert.equal(result.nearParagraphCount,0);
 assert.equal(result.contextGroups[0].status,"UNLABELLED_PARAGRAPH");
 assert.equal(result.contextGroups[0].attributionByChunk[0].statementKind,"OBJECTION");
});
test("invalid records are rejected and do not yield false positive evidence",()=>{
 assert.throws(()=>analyzeParagraphContext({questionId:"q",retrieved:[{rank:1,passageId:"missing",locator:"Source paragraph 086"}],catalog,evidence}),/missing from catalog/);
 assert.throws(()=>analyzeParagraphContext({questionId:"q",retrieved:[],catalog,evidence:[]}),/No reference/);
});

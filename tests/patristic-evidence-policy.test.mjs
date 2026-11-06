import test from "node:test";
import assert from "node:assert/strict";
import {assessPassageEvidence} from "../scripts/patristics/assess-passage-evidence.mjs";

const verified = {
  attributionStatus:"TEXT_VERIFIED",
  speakerName:"Gregory of Nyssa",
  attributionEvidenceUrl:"https://www.newadvent.org/fathers/2915.htm"
};

test("retrieved but unreviewed material cannot be promoted to doctrine",()=>{
  const result=assessPassageEvidence({attributionStatus:"UNREVIEWED",statementKind:"TEACHING",speakerName:"Gregory"});
  assert.equal(result.evidenceRole,"UNVERIFIED_SPEAKER_OR_CONTEXT");
  assert.equal(result.mayPresentAsAuthorTeaching,false);
});

test("a verified speaker's objections, questions, and quotations are not doctrines",()=>{
  for(const statementKind of ["OBJECTION","QUESTION","QUOTATION"]){
    const result=assessPassageEvidence({...verified,statementKind});
    assert.equal(result.evidenceRole,"NON_ASSERTIVE_DIALOGUE");
    assert.equal(result.mayPresentAsAuthorTeaching,false);
  }
});

test("verified teaching form still requires doctrinal contextual review",()=>{
  for(const statementKind of ["TEACHING","ANSWER"]){
    const result=assessPassageEvidence({...verified,statementKind});
    assert.equal(result.evidenceRole,"SPEAKER_VERIFIED_DOCTRINE_UNREVIEWED");
    assert.equal(result.mayPresentAsAuthorTeaching,false);
  }
});

test("narration without argument context stays unconfirmed",()=>{
  const result=assessPassageEvidence({...verified,statementKind:"NARRATION"});
  assert.equal(result.evidenceRole,"CONTEXT_REVIEW_REQUIRED");
  assert.equal(result.mayPresentAsAuthorTeaching,false);
});

test("speaker labels without verifiable source are not trusted",()=>{
  const result=assessPassageEvidence({...verified,attributionEvidenceUrl:null,statementKind:"TEACHING"});
  assert.equal(result.evidenceRole,"UNVERIFIED_SPEAKER_OR_CONTEXT");
  assert.equal(result.mayPresentAsAuthorTeaching,false);
});

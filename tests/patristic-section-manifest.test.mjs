import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {buildProvisionalManifest} from "../scripts/patristics/plan-gregory-sections.mjs";
const hash=s=>createHash("sha256").update(s).digest("hex");
const paragraphs=[
  ("Gregory asks whether death must be feared. Macrina considers the answer. ").repeat(50).trim(),
  ("Her reply proceeds cautiously through questions and arguments. ").repeat(55).trim(),
  ("Resurrection is explored through the context of the dialogue. ").repeat(60).trim()
];
const makeDoc=()=>({
  metadata:{
    sourceUrl:"https://www.newadvent.org/fathers/2915.htm",
    author:"St. Gregory of Nyssa",work:"On the Soul and the Resurrection",
    edition:"NPNF 1893",
    extraction:{coverage:"UNVERIFIED_PREVIEW",paragraphCount:paragraphs.length,sha256:hash(paragraphs.join("\n\n"))}
  },
  paragraphs
});
test("manifest preserves complete text and source paragraph order",()=>{
  const plan=buildProvisionalManifest(makeDoc());
  assert.equal(plan.status,"PREVIEW_ONLY_NOT_IMPORTED");
  assert.ok(plan.passageCount>plan.paragraphCount);
  assert.equal(plan.allChunksWithinLimit,true);
  assert.equal(plan.firstLocator,"Source paragraph 001");
  assert.equal(plan.lastLocator,"Source paragraph 003");
  assert.equal(plan.sourceSha256,hash(paragraphs.join("\n\n")));
});
test("manifest refuses mutated text and unverifiable status",()=>{
  const doc=makeDoc();
  doc.paragraphs=[...paragraphs,"An uncatalogued appendage"];
  assert.throws(()=>buildProvisionalManifest(doc),/mismatch/);
  const other=makeDoc();
  other.metadata.extraction.coverage="COMPLETE_MANIFEST";
  assert.throws(()=>buildProvisionalManifest(other),/mismatch/);
});

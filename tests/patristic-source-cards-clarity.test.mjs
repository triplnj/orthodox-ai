import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const cards=readFileSync("src/components/chat/SourceCards.tsx","utf8");
test("automated source matches are clearly text matches, never doctrinal certifications",()=>{
 assert.match(cards,/Automated text match — interpretation not independently verified/);
 assert.match(cards,/not the theological meaning, identity of a dialogue speaker, or permission for direct quotation/);
 assert.doesNotMatch(cards,/Claim linked to a matching excerpt \(automated review\)/);
});
test("source passages without a linked claim have an explanatory label",()=>{
 assert.match(cards,/!\(source\.claimMappings \?\? \[\]\)\.length/);
 assert.match(cards,/No specific claim in this answer was linked to a matching excerpt/);
});

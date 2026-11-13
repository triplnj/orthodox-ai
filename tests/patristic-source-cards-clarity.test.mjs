import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const cards=readFileSync("src/components/chat/SourceCards.tsx","utf8");
test("automated source matches are clearly text matches, never doctrinal certifications",()=>{
 assert.match(cards,/Automated text match — interpretation not independently verified/);
 assert.match(cards,/do not assert that the theological meaning, dialogue speaker, or permission for direct quotation/);
 assert.doesNotMatch(cards,/Claim linked to a matching excerpt \(automated review\)/);
});
test("source passages without a linked claim have an explanatory label",()=>{
 assert.match(cards,/!\(source\.claimMappings \?\? \[\]\)\.length/);
 assert.match(cards,/No specific claim in this answer was linked to a matching excerpt/);
});

test("bibliographic evidence has a work-role grouping rather than an unmatched excerpt warning",()=>{
 assert.match(cards,/bibliographyUrls = new Map/);
 assert.match(cards,/metadata\?\.bibliographyCatalog === true/);
 assert.match(cards,/Reviewed bibliographic attribution records/);
 assert.match(cards,/metadata\?\.supportingStatement/);
});

test("unreviewed bibliography graph sources cannot be falsely labeled reviewed in the UI",()=>{
 assert.match(cards,/const isProvisionalGraph = bibliography\.some/);
 assert.match(cards,/metadata\?\.graphRecord === true/);
 assert.match(cards,/External bibliography index or source-crosschecked metadata/);
 assert.match(cards,/External bibliographic metadata — independent review pending/);
 assert.match(cards,/isProvisionalGraph \?/);
});

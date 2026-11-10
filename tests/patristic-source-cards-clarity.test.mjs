import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const cards=readFileSync("src/components/chat/SourceCards.tsx","utf8");
test("automated source matches never imply semantic or quote approval",()=>{
 assert.match(cards,/Automated text match — interpretation not independently verified/);
 assert.match(cards,/not the theological meaning, identity of a dialogue speaker, or permission for direct quotation/);
 assert.doesNotMatch(cards,/Claim linked to a matching excerpt \(automated review\)/);
});
test("a retrieved source without a linked claim is visibly distinguished",()=>{
 assert.match(cards,/!\(source\.claimMappings \?\? \[\]\)\.length/);
 assert.match(cards,/No specific claim in this answer was linked to a matching excerpt/);
});

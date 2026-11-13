import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const excerpts = [
 {provider:"CURATED_TEXT", authorName:"St. John Chrysostom", workTitle:"On Vainglory",
  metadata:{excerpt:"Parents should guide their children with correction and exhortation rather than relying on harsh punishment."}},
 {provider:"WEB_RESEARCH", authorName:null, workTitle:null, metadata:{}}
];
const mockedOpenAI = {
 chat:{completions:{create:async ({messages})=>{
  const request = JSON.parse(messages.at(-1).content);
  if (Object.hasOwn(request,"claim")) {
    return {choices:[{message:{content:JSON.stringify({fullySupported:!request.claim.includes("number 1")})}}]};
  }
  const {units} = request;
  return {choices:[{message:{content:JSON.stringify({links:units.map(item=>({
   unit:item.unit, sourceIndex: item.unit===0 ? 0 : 1,
   evidenceQuote:item.unit===0 ? "Parents should guide their children with correction and exhortation" : "Invented evidence from an unrelated URL"
  }))})}}]};
 }}}
};
const {auditPatristicClaims,splitAuditableClaims}=createLoader({
 "server-only":{}, "@/lib/ai/openaiClient":{getOpenAI:()=>mockedOpenAI},
})("src/lib/chat/claim-audit.ts");

test("every sentence is audited, including claims after the old six-claim limit",async()=>{
 const answer=Array.from({length:9},(_,i)=>"Test claim number "+i+" deserves independent evidence.").join(" ");
 const audit=await auditPatristicClaims(answer,excerpts);
 assert.equal(audit.status,"completed");
 assert.equal(audit.claims.length,9);
 assert.equal(audit.claims[0].status,"excerpt_matched");
 assert.equal(audit.claims[1].status,"needs_review");
 assert.equal(audit.claims[8].status,"needs_review");
});
test("source URLs without actual excerpts cannot verify claims",async()=>{
 const audit=await auditPatristicClaims("This sentence is an unsupported claim.",[excerpts[1]]);
 assert.equal(audit.status,"unavailable");
 assert.equal(audit.claims[0].status,"needs_review");
});
test("paragraphs and bullets remain individual units",()=>{
 assert.equal(splitAuditableClaims("First substantial assertion. Second substantial assertion.\n- Third detailed assertion.").length,3);
});

test("an offer of additional citations is not misidentified as a patristic claim",()=>{
 const units=splitAuditableClaims("Ако желите, могу вам понудити и конкретне цитате из његових беседа или упутства за даље читање.");
 assert.equal(units.length,0);
});
test("real theological claim is retained while conversational offer is excluded",()=>{
 const units=splitAuditableClaims("Родитељи имају важну одговорност у васпитању деце. Ако желите, могу вам понудити и цитате.");
 assert.equal(units.length,1);
});

test("independent verifier rejects excerpt which does not entail the claim",async()=>{
 const badOpenAI = {chat:{completions:{create:async ({messages})=>{
  const input=JSON.parse(messages.at(-1).content);
  if (input.claim) return {choices:[{message:{content:'{"fullySupported":false}'}}]};
  return {choices:[{message:{content:JSON.stringify({links:[{unit:0,sourceIndex:0,evidenceQuote:"Parents should guide their children with correction and exhortation"}]})}}]};
 }}}};
 const {auditPatristicClaims:audit}=createLoader({
  "server-only":{}, "@/lib/ai/openaiClient":{getOpenAI:()=>badOpenAI}
 })("src/lib/chat/claim-audit.ts");
 const result=await audit("Children must be punished with blows for every mistake.",excerpts);
 assert.equal(result.claims[0].status,"needs_review");
 assert.equal(result.claims[0].sourceIndex,null);
});

test("specific discipline claim cannot be linked to generic virtue passage",()=>{
 const {evidenceHasClaimAnchors}=createLoader({
  "server-only":{}, "@/lib/ai/openaiClient":{getOpenAI:()=>mockedOpenAI},
 })("src/lib/chat/claim-audit.ts");
 const claim="Свети Јован препоручује употребу погледа, прекора и физичких казни.";
 const quote="In all wisdom, teaching and admonishing one another. Virtue he calls wisdom.";
 assert.equal(evidenceHasClaimAnchors(claim,quote),false);
});
test("parents-as-primary-educators claim is not established by obedience verse",()=>{
 const {evidenceHasClaimAnchors}=createLoader({
  "server-only":{}, "@/lib/ai/openaiClient":{getOpenAI:()=>mockedOpenAI},
 })("src/lib/chat/claim-audit.ts");
 assert.equal(evidenceHasClaimAnchors("Родитељи треба да буду први и најважнији васпитачи.","Children, obey your parents in the Lord, for this is right."),false);
 assert.equal(evidenceHasClaimAnchors("Родитељи треба да буду први и најважнији васпитачи.","Parents must teach their children wisely."),true);
});

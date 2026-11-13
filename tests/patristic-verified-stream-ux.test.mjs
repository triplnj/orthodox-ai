import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("verified large patristic delta is revealed word by word",()=>{
 const client=readFileSync("src/components/chat/ChatBox.tsx","utf8");
 assert.match(client,/value\.text\.length >= 160/);
 assert.match(client,/verifiedReveal = revealVerifiedDelta\(value\.text\)/);
 assert.match(client,/const words = text\.match\(/);
 assert.match(client,/window\.setTimeout\(tick, 22\)/);
 assert.match(client,/if \(verifiedReveal\) await verifiedReveal/);
});
test("ordinary streaming stays incremental and server final answer replaces visual provisional text",()=>{
 const client=readFileSync("src/components/chat/ChatBox.tsx","utf8");
 assert.match(client,/else if \(!partialStarted\)/);
 assert.match(client,/else if \(!verifiedReveal\)/);
 assert.match(client,/setMessages\(current => current\.slice\(0, -1\)\)/);
 assert.match(client,/content: data\.answer, sources: data\.patristicSources/);
});
test("server source verification still precedes delivered patristic text",()=>{
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 assert.ok(route.indexOf("verifyPatristicAnswerClaims(result.answer")>0);
 assert.ok(route.indexOf("onDelta?.(result.answer)")>route.indexOf("verifyPatristicAnswerClaims(result.answer"));
 assert.match(route,/onDelta: reviewedPilot \|\| evidenceRequired \? undefined : onDelta/);
});

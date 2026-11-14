import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const cards=readFileSync("src/components/chat/SourceCards.tsx","utf8");
const chat=readFileSync("src/components/chat/ChatBox.tsx","utf8");
const route=readFileSync("src/app/api/chat/route.ts","utf8");

test("patristic sources are a numbered list rather than ungrounded claim certifications",()=>{
 assert.match(cards,/<ol className="mt-2 list-decimal/);
 assert.match(cards,/groups\.map/);
 assert.match(cards,/safeLink\(source\.scanUrl/);
 assert.doesNotMatch(cards,/Claim linked to a verbatim excerpt/);
 assert.match(cards,/does not independently verify every assertion/);
});
test("bibliographic work and role records survive numbered reference presentation",()=>{
 assert.match(cards,/metadata\?\.bibliographyCatalog === true/);
 assert.match(cards,/metadata\?\.evidenceId/);
 assert.match(cards,/item\.metadata\?\.roles/);
});
test("the exact required disclaimer is shown at the end of every rendered assistant message",()=>{
 assert.match(chat,/message\.role === "assistant" && <>/);
 const references=chat.indexOf("<SourceCards sources={message.sources ?? []} />");
 const warning=chat.indexOf("OrthodoxAI may make a mistake. Check relevant sources");
 assert.ok(references >= 0 && warning > references);
 assert.match(chat,/message\.role === "assistant" \? renderAnswerEmphasis\(message\.content\)/);
});
test("source-checker failure cannot discard the generated answer",()=>{
 assert.doesNotMatch(route,/gatePatristicAnswer/);
 assert.doesNotMatch(route,/doctrinalSourceGate/);
 assert.match(route,/onDelta: reviewedPilot \? undefined : onDelta/);
 assert.match(route,/const sources = snapshotSources\(research\?\.sources \?\? \[\], true\)/);
});

test("an untitled discovery link shows its real URL host rather than an invented generic title",()=>{
 assert.match(cards,/Untitled reference/);
 assert.match(cards,/new URL\(url\)\.hostname/);
 assert.doesNotMatch(cards,/"Research source"/);
});

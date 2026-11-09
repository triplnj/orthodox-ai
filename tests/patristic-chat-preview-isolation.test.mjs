import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("src/lib/preview/chat-isolation.ts","utf8");
const route=readFileSync("src/app/api/chat/route.ts","utf8");
test("preview branch must validate isolation before loading an authenticated user",()=>{
 const guard=route.indexOf("await enforceChatPreviewIsolation(");
 const user=route.indexOf("const user = await getCurrentUser()");
 assert.ok(guard>0&&user>guard,"Chat guard must execute before authentication");
});
test("preview gate checks dedicated branch, Neon credentials and scrub marker",()=>{
 assert.match(source,/br-empty-breeze-asd2dqrq/);
 assert.match(source,/ORTHODOXAI_CHAT_ISOLATED_PREVIEW/);
 assert.match(source,/ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID/);
 assert.match(source,/PATRISTIC_CHAT_ISOLATED_PREVIEW/);
 assert.match(source,/nonTestUsers/);
 assert.match(route,/lower\("email"\) NOT LIKE '%@example\.test'/);
});
test("isolation gate must reject default global Preview DATABASE_URL",()=>{
 assert.match(source,/throw Error\("PREVIEW_CHAT_BLOCKED: isolation configuration missing"\)/);
 assert.match(source,/throw Error\("PREVIEW_CHAT_BLOCKED: database guard does not prove isolation"\)/);
 assert.match(route,/enforceChatPreviewIsolation/);
});

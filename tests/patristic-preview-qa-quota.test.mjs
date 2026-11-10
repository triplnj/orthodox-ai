import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync("src/lib/ai/operationLimits.ts","utf8");
test("QA exemption is limited to exact test identity and isolated preview config",()=>{
 assert.match(s,/user\?\.email\?\.toLowerCase\(\) === "patristic-qa@example\.test"/);
 assert.match(s,/process\.env\.ORTHODOXAI_CHAT_ISOLATED_PREVIEW === "1"/);
 assert.match(s,/assertIsolatedPreviewConfig\(\)/);
});
test("only daily cap is skipped, while other safety limits remain",()=>{
 assert.match(s,/!isIsolatedPreviewQaChat\(feature, user\) && used >= dailyLimit/);
 assert.match(s,/recent >= CHAT_RATE_LIMIT_PER_MINUTE/);
 assert.match(s,/running >= 1/);
 assert.match(s,/QA_PREVIEW_CHAT_LIMIT = 1_000_000_000/);
});
test("normal FREE and Full Access limits remain unchanged",()=>{
 const flags=readFileSync("src/lib/features.ts","utf8");
 assert.match(flags,/FREE_DAILY_CHAT_LIMIT = 3/);
 assert.match(flags,/FULL_ACCESS_DAILY_CHAT_LIMIT = 100/);
});

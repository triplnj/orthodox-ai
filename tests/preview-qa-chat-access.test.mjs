import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const good = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feature/patristic-bibliography-step5-answer-audit-20261111",
  ORTHODOXAI_CHAT_ISOLATED_PREVIEW: "true",
  ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID: "br-fancy-recipe-astk5ot6",
  ORTHODOXAI_PREVIEW_QA_CHAT: "enabled",
};
const fn = (env) => createLoader({}, env)("src/lib/ai/previewQaAccess.ts").isIsolatedPreviewQaChatUser;

test("only exact test identity on isolated PR61 Preview gets QA chat allowance", () => {
  const allowed = fn(good);
  assert.equal(allowed("pr61_preview_test_20261112"), true);
  for (const id of ["admin", "different-user", "", "pr61_preview_test_20261112x"])
    assert.equal(allowed(id), false);
});
test("no QA allowance for production, other branches, or missing isolation guard", () => {
  for (const [key, value] of [
    ["VERCEL_ENV", "production"], ["VERCEL_ENV", "development"],
    ["VERCEL_GIT_COMMIT_REF", "main"],
    ["ORTHODOXAI_CHAT_ISOLATED_PREVIEW", "false"],
    ["ORTHODOXAI_CHAT_PREVIEW_DB_BRANCH_ID", "br-flat-mode-as1mxdf8"],
    ["ORTHODOXAI_PREVIEW_QA_CHAT", "disabled"],
  ]) assert.equal(fn({ ...good, [key]: value })("pr61_preview_test_20261112"), false, key);
  for (const key of Object.keys(good).filter(key => key !== "VERCEL_GIT_COMMIT_REF"))
    assert.equal(fn({ ...good, [key]: "" })("pr61_preview_test_20261112"), false, key);
  assert.equal(fn({ ...good, VERCEL_GIT_COMMIT_REF: "" })("pr61_preview_test_20261112"), true);
  const { VERCEL_GIT_COMMIT_REF: unused, ...withoutGitRef } = good;
  assert.equal(fn(withoutGitRef)("pr61_preview_test_20261112"), true);
});
test("QA setting stays chat-only and keeps normal quota admission controls", async () => {
  const fs = await import("node:fs");
  const code = fs.readFileSync("src/lib/ai/operationLimits.ts", "utf8");
  assert.match(code, /isIsolatedPreviewQaChatUser\(user.id\)/);
  assert.match(code, /feature === "chat" \?/);
  assert.match(code, /PERSONAL_FEATURES.includes\(feature\) && user && !isProUser\(user\)/);
  assert.match(code, /recent >= CHAT_RATE_LIMIT_PER_MINUTE/);
  assert.match(code, /if \(running >= 1\)/);
});

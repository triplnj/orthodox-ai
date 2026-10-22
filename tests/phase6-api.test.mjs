import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { phase6Harness, free, pro } from "./helpers/phase6-harness.mjs";
mock.method(globalThis, "fetch", () => { throw new Error("Live network forbidden"); });
mock.method(console, "error", () => {});
for (const [name, body, status] of [["malformed JSON", "{", 400], ["array", "[]", 400], ["null", "null", 400], ["scalar", '"text"', 400]]) test(name, async () => {
  const h = phase6Harness(); const response = await h.send("chat", {}, { body }); assert.equal(response.status, status); assert.equal(h.state.logs.length, 0); assert.equal(typeof (await response.json()).code, "string");
});
for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", ""]) test(`unsupported media type ${type}`, async () => {
  const h = phase6Harness(); assert.equal((await h.send("chat", { message: "Q" }, { headers: { "Content-Type": type } })).status, 415); assert.equal(h.state.modelCalls, 0);
});
for (const type of ["application/json; charset=utf-8", "application/vnd.example+json"]) test(`supported media type ${type}`, async () => {
  const h = phase6Harness(); assert.equal((await h.send("chat", { message: "Q" }, { headers: { "Content-Type": type } })).status, 200);
});
for (const body of [{ message: {} }, { message: "Q", requestId: "../x" }, { message: "Q", conversationId: "x".repeat(129) }, { message: "Q", role: "system" }]) test(`invalid chat input ${JSON.stringify(body)}`, async () => {
  const h = phase6Harness(); assert.equal((await h.send("chat", body)).status, 400); assert.equal(h.state.logs.length, 0);
});
test("oversized body rejected before quota", async () => { const h = phase6Harness(); assert.equal((await h.send("chat", { message: "x".repeat(70000) })).status, 413); assert.equal(h.state.logs.length, 0); });
for (const path of ["pro/prayer-plan", "pro/fasting-plan", "pro/scripture-plan"]) test(`${path}: invalid enums and unknown fields do not reserve`, async () => {
  const h = phase6Harness(); assert.equal((await h.send(path, { experienceLevel: "administrator" })).status, 400); assert.equal((await h.send(path, { userId: "bob" })).status, 400); assert.equal(h.state.reservations.length, 0);
});
test("journal summary missing resource consumes no personal quota", async () => { const h = phase6Harness(); assert.equal((await h.send("journal/summarize", { entryId: "missing" })).status, 404); assert.equal(h.state.reservations.length, 0); });
test("another user's or oversized journal cannot consume quota", async () => {
  for (const entry of [{ id: "entry", userId: "bob", content: "Secret" }, { id: "entry", userId: "alice", content: "x".repeat(40001) }]) {
    const h = phase6Harness(); h.state.entries.push(entry); assert.ok([404, 413].includes((await h.send("journal/summarize", { entryId: "entry" })).status)); assert.equal(h.state.reservations.length, 0);
  }
});
test("journal creation validates title type and bounds", async () => { const h = phase6Harness(); for (const title of [{}, "x".repeat(201)]) assert.equal((await h.send("journal", { title, content: "Text" })).status, 400); assert.equal(h.state.entries.length, 0); });
test("profile and onboarding reject coercion and extra fields", async () => {
  const h = phase6Harness(); const route = h.load("src/app/api/settings/profile/route.ts");
  assert.equal((await route.PATCH(h.request("settings/profile", { name: { value: "x" } }))).status, 400);
  assert.equal((await h.send("onboarding", { spiritualGoal: ["build prayer habit"], experienceLevel: "beginner", dailyTime: "5 minutes" })).status, 400);
});
test("query parameters reject duplicates, invalid features and cross-user identifiers", async () => {
  const h = phase6Harness(); const get = h.load("src/app/api/ai/usage/route.ts").GET;
  for (const query of ["feature=chat&feature=chat", "feature=research", "userId=bob"]) assert.equal((await get(new Request(`https://example.test?${query}`))).status, 400);
});
test("structured errors redact internal diagnostics", async () => {
  const h = phase6Harness(); const response = h.load("src/lib/api/response.ts").apiJson({ error: "password=SECRET SQL failed", details: "stacktrace" }, { status: 500 });
  const body = await response.json(); assert.equal(body.code, "INTERNAL_ERROR"); assert.ok(!JSON.stringify(body).includes("SECRET")); assert.ok(!("details" in body));
  const safe = await h.load("src/lib/api/response.ts").apiJson({ error: "Checkout outcome is uncertain. Contact billing support before retrying.", code: "BILLING_REQUEST_FAILED" }, {status:503}).json();
  assert.match(safe.error,/Contact billing support before retrying/);
});
for (const [user, limit] of [[free, 5], [pro, 100]]) test(`${user.plan}: final admitted chat returns an answer and next request rejects`, async () => {
  const h = phase6Harness({ user });
  for (let i = 0; i < limit - 1; i++) h.state.logs.push({ userId: user.id, feature: "chat", createdAt: new Date(Date.now() - 120000) });
  const response = await h.send("chat", { message: "Final question", requestId: "final" }); assert.equal(response.status, 200);
  const answer = await response.json(); assert.equal(answer.answer, "Answer"); assert.equal(answer.remaining, 0);
  const rejected = await h.send("chat", { message: "One too many", requestId: "extra" }); assert.equal(rejected.status, 429);
  const error = await rejected.json(); assert.equal(error.code, "DAILY_QUOTA_EXHAUSTED"); assert.equal(error.remaining, 0); assert.ok(error.retryAfterSeconds > 60);
  assert.equal(h.state.logs.length, limit); assert.equal(h.state.modelCalls, 1);
});
test("chat replay reports fresh allowance without changing its saved answer snapshot", async () => {
  const h = phase6Harness({ user: free }); const body = { message: "Q", requestId: "same" };
  const original = await (await h.send("chat", body)).json(); await h.send("chat", { message: "Second", requestId: "second" });
  const replay = await (await h.send("chat", body)).json(); assert.equal(original.remaining, 4); assert.equal(replay.remaining, 3); assert.equal(replay.replayed, true); assert.equal(h.state.modelCalls, 2);
  assert.equal(h.state.turns[0].responseSnapshot.remaining, 4);
});
test("midnight reset and independent quota pools", async () => {
  const h = phase6Harness(); const clock = h.load("src/lib/ai/quotaClock.ts"); const day = clock.quotaDay();
  h.state.logs.push({ userId: "alice", feature: "chat", createdAt: new Date(day.start.getTime() - 1) });
  h.state.reservations.push({ subject: "alice", feature: "prayer-plan", status: "FAILED", createdAt: new Date() });
  const quotas = h.load("src/lib/ai/operationLimits.ts"); assert.equal((await quotas.quotaSnapshot("alice", "chat", pro)).remaining, 100); assert.equal((await quotas.quotaSnapshot("alice", "fasting-plan", pro)).remaining, 29);
});
for (const [date, hours] of [["2026-03-29T12:00:00Z", 23], ["2026-10-25T12:00:00Z", 25]]) test(`explicit timezone handles DST ${date}`, () => {
  const h = phase6Harness({ env: { AI_QUOTA_TIMEZONE: "Europe/Berlin" } }); const day = h.load("src/lib/ai/quotaClock.ts").quotaDay(new Date(date)); assert.equal((day.reset - day.start) / 3600000, hours);
});
test("production quota operations fail closed without explicit timezone", () => {
  const h = phase6Harness({ env: { NODE_ENV: "production", AI_QUOTA_TIMEZONE: undefined } }); assert.throws(() => h.load("src/lib/ai/quotaClock.ts").quotaDay(), /explicitly/);
});
test("frontend quota snapshots cannot overwrite a newer counter", () => {
  const h = phase6Harness(); const { newerQuota, errorMessage } = h.load("src/lib/api/clientErrors.ts");
  const current = { remaining: 0, observedAt: "2026-10-20T12:01:00Z" }; assert.equal(newerQuota(current, { remaining: 4, observedAt: "2026-10-20T12:00:00Z" }).remaining, 0);
  assert.match(errorMessage({ error: "Wait", limitType: "rate", retryAfterSeconds: 20 }), /temporary rate limit/);
  assert.doesNotMatch(errorMessage({ error: "Exhausted", limitType: "daily" }), /temporary rate limit/);
});
test("no-input GET endpoints reject ignored query and pagination fields", async () => {
  const h=phase6Harness();
  for(const path of ["journal","history","conversations","account","dashboard","settings/export"]) {
    const response=await h.load(`src/app/api/${path}/route.ts`).GET(new Request(`https://example.test/api/${path}?limit=NaN`));
    assert.equal(response.status,400,path);
  }
});
test("invalid dates and repeated parameters are rejected instead of coerced", () => {
  const h=phase6Harness(); const {queryInput}=h.load("src/lib/api/validation.ts");
  assert.throws(()=>queryInput(new Request("https://example.test?date=2026-99-99")),{status:400});
  assert.throws(()=>queryInput(new Request("https://example.test?requestId=a&requestId=b"),["requestId"]),{status:400});
});
test("invalid configured timezone fails closed without reserving quota", async () => {
  const h=phase6Harness({env:{AI_QUOTA_TIMEZONE:"Invalid/Zone"}}); assert.equal((await h.send("chat",{message:"Q"})).status,503); assert.equal(h.state.reservations.length,0);
  for (const path of ["account","dashboard"]) assert.equal((await h.load(`src/app/api/${path}/route.ts`).GET(new Request(`https://example.test/api/${path}`))).status,503,path);
});
test("blog validation rejects File values, duplicate fields, unknown IDs and oversized content", () => {
  const h=phase6Harness(); const {blogForm}=h.load("src/lib/api/blogInput.ts");
  const form=()=>{const data=new FormData();data.set("title","Title");data.set("content","Content");return data;};
  for(const mutate of [data=>data.set("title",new Blob(["file"]),"x"),data=>data.append("title","duplicate"),data=>data.set("role","ADMIN"),data=>data.set("content","x".repeat(524289))]) {
    const data=form();mutate(data);assert.throws(()=>blogForm(data,"create"),{status:400});
  }
});

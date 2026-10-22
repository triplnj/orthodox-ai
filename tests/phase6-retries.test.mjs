import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { phase6Harness, pro } from "./helpers/phase6-harness.mjs";
import { createLoader } from "./helpers/load-ts.mjs";
mock.method(globalThis, "fetch", () => { throw new Error("Live network forbidden"); });
mock.method(console, "error", () => {});
const path = "pro/prayer-plan";
const body = { requestId: "request-1", experienceLevel: "beginner", focus: "prayer" };
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); } throw new Error("Expected state not reached"); }
test("personal completed replay returns original result and charges once", async () => {
  const h = phase6Harness(); const first = await h.send(path, body); assert.equal(first.status, 200);
  const replay = await h.send(path, body); assert.equal(replay.status, 200); assert.equal((await replay.json()).replayed, true);
  assert.equal(h.state.modelCalls, 1); assert.equal(h.state.reservations.length, 1); assert.equal(h.state.reservations[0].status, "COMPLETED");
});
test("same key with changed input is a conflict without another call", async () => {
  const h = phase6Harness(); await h.send(path, body); assert.equal((await h.send(path, { ...body, focus: "changed" })).status, 409); assert.equal(h.state.modelCalls, 1);
});
test("simultaneous duplicate personal requests call provider once", async () => {
  const h = phase6Harness(); let finish; h.state.gate = new Promise(resolve => { finish = resolve; });
  const first = h.send(path, body); await until(() => h.state.modelCalls === 1);
  const competing = await Promise.all(Array.from({ length: 8 }, () => h.send(path, body)));
  assert.ok(competing.every(response => response.status === 409)); finish(); assert.equal((await first).status, 200);
  assert.equal(h.state.modelCalls, 1); assert.equal(h.state.reservations.length, 1);
});
test("concurrent distinct keys share unchanged per-user capacity", async () => {
  const h = phase6Harness(); let finish; h.state.gate = new Promise(resolve => { finish = resolve; });
  const first = h.send(path, body); await until(() => h.state.modelCalls === 1);
  assert.equal((await h.send(path, { ...body, requestId: "other" })).status, 429); finish(); await first;
  assert.equal(h.state.reservations.length, 1);
});
test("recovery fences completion and preserves the active capacity lease until settlement", async () => {
  const h = phase6Harness(); let finish; h.state.gate = new Promise(resolve => { finish = resolve; });
  const first = h.send(path, body); await until(() => h.state.modelCalls === 1);
  const service = h.load("src/lib/ai/personalRequests.ts");
  await service.recoverPersonalRequest(pro, "prayer-plan", body.requestId);
  assert.equal((await h.send(path, { ...body, requestId: "next" })).status, 429);
  finish(); assert.equal((await first).status, 409); assert.equal(h.state.reservations[0].status, "ABANDONED"); assert.equal(h.state.reservations[0].responseSnapshot, null);
  h.state.gate = null; assert.equal((await h.send(path, { ...body, requestId: "after" })).status, 200); assert.equal(h.state.reservations.length, 2);
});
test("expired lease never re-executes the same request key", async () => {
  const h = phase6Harness(); h.state.failCommit = true; assert.equal((await h.send(path, body)).status, 503); h.state.failCommit = false;
  h.state.reservations[0].expiresAt = new Date(0);
  assert.equal((await h.send(path, body)).status, 409); assert.equal(h.state.modelCalls, 1);
});
test("known provider failure retains charge and same-key retry cannot generate again", async () => {
  const h = phase6Harness(); h.state.failModel = true; assert.equal((await h.send(path, body)).status, 500);
  h.state.failModel = false; assert.equal((await h.send(path, body)).status, 409); assert.equal(h.state.reservations.length, 1); assert.equal(h.state.modelCalls, 1);
});
test("completed and failed quota records both count toward the personal allowance", async () => {
  const h = phase6Harness(); for (let i = 0; i < 29; i++) h.state.reservations.push({ subject: "alice", feature: "fasting-plan", status: i % 2 ? "FAILED" : "COMPLETED", createdAt: new Date(Date.now() - 120000) });
  assert.equal((await h.send(path, body)).status, 200); assert.equal((await h.send(path, { ...body, requestId: "over" })).status, 429);
  assert.equal(h.state.reservations.length, 30); assert.equal(h.state.modelCalls, 1);
});
test("seven-day cleanup removes private payload while retaining identity and accounting", async () => {
  const h = phase6Harness(); await h.send(path, body); const row = h.state.reservations[0]; row.finishedAt = new Date(Date.now() - 8 * 86400000);
  const service = h.load("src/lib/ai/personalRequests.ts"); assert.equal((await service.cleanupPrivateResponses("alice")).count, 1);
  assert.equal(row.status, "RESULT_EXPIRED"); assert.equal(row.responseSnapshot, null); assert.equal(row.requestKey, body.requestId); assert.ok(row.requestHash);
  assert.equal((await h.send(path, body)).status, 410); assert.equal(h.state.modelCalls, 1); assert.equal(h.state.reservations.length, 1);
});
test("cleanup does not expire recent responses, active work or another user's cache", async () => {
  const h = phase6Harness(); await h.send(path, body);
  h.state.reservations.push({ ...h.state.reservations[0], id: "foreign", subject: "bob", userId: "bob", finishedAt: new Date(0) });
  assert.equal((await h.load("src/lib/ai/personalRequests.ts").cleanupPrivateResponses("alice")).count, 0);
  assert.equal(h.state.reservations[1].status, "COMPLETED");
});
test("private result and recovery endpoints enforce ownership", async () => {
  const h = phase6Harness(); await h.send(path, body); h.state.user = { ...pro, id: "bob" };
  const response = await h.load("src/app/api/ai/requests/route.ts").GET(new Request("https://example.test?feature=prayer-plan&requestId=request-1")); assert.equal(response.status, 404);
  assert.equal((await h.send("ai/requests/recover", { feature: "prayer-plan", requestId: "request-1" })).status, 404);
});
test("completed personal requests cannot be recovered or overwritten", async () => {
  const h = phase6Harness(); await h.send(path, body);
  assert.equal((await h.send("ai/requests/recover", { feature: "prayer-plan", requestId: "request-1" })).status, 409);
  assert.equal(h.state.reservations[0].status, "COMPLETED");
});
test("summary and its cache are committed together, then replayed without another write", async () => {
  const h = phase6Harness(); h.state.entries.push({ id: "entry", userId: "alice", content: "Reflection", title: "Title", updatedAt: new Date() });
  const input = { entryId: "entry", requestId: "summary" };
  const response = await h.send("journal/summarize", input); assert.equal(response.status, 200); assert.equal(h.state.entries[0].aiSummary, "Answer");
  assert.equal((await h.send("journal/summarize", input)).status, 200); assert.equal(h.state.modelCalls, 1);
  assert.equal(h.state.reservations[0].responseSnapshot.entry.content, "Reflection");
});
test("summary commit failure rolls back journal and cache; retry does not call AI", async () => {
  const h = phase6Harness(); h.state.entries.push({ id: "entry", userId: "alice", content: "Reflection", title: "Title", updatedAt: new Date() }); h.state.failCommit = true;
  const input = { entryId: "entry", requestId: "summary" }; assert.equal((await h.send("journal/summarize", input)).status, 503);
  assert.equal(h.state.entries[0].aiSummary, undefined); assert.equal(h.state.reservations[0].responseSnapshot, null);
  h.state.failCommit = false; assert.equal((await h.send("journal/summarize", input)).status, 409); assert.equal(h.state.modelCalls, 1);
});
test("recovery during summary generation prevents a late journal update", async () => {
  const h = phase6Harness(); h.state.entries.push({ id: "entry", userId: "alice", content: "Reflection", title: "Title", updatedAt: new Date() });
  let finish; h.state.gate = new Promise(resolve => { finish = resolve; }); const first = h.send("journal/summarize", { entryId: "entry", requestId: "summary" }); await until(() => h.state.modelCalls === 1);
  await h.load("src/lib/ai/personalRequests.ts").recoverPersonalRequest(pro, "journal-summary", "summary"); finish(); assert.equal((await first).status, 409); assert.equal(h.state.entries[0].aiSummary, undefined);
});
test("deleting account state while a provider runs cannot recreate a private cache", async () => {
  const h = phase6Harness(); let finish; h.state.gate = new Promise(resolve => { finish = resolve; }); const first = h.send(path, body); await until(() => h.state.modelCalls === 1);
  h.state.reservations = []; h.state.user = null; finish(); assert.equal((await first).status, 409); assert.equal(h.state.reservations.length, 0);
});
test("cleanup endpoint requires an explicit server-side secret", async () => {
  const h = phase6Harness(); assert.equal((await h.send("internal/ai-cache-cleanup", {})).status, 401);
});
test("retention writes Prisma database NULL rather than JSON null", async () => {
  const DbNull={kind:"database-null"},JsonNull={kind:"json-null"};let captured;
  const load=createLoader({"server-only":{},"@/generated/prisma/client":{Prisma:{DbNull,JsonNull}},"@/lib/prisma":{prisma:{aiReservation:{updateMany:async input=>{captured=input;return{count:1};}}}}});
  await load("src/lib/ai/personalRequests.ts").cleanupPrivateResponses(); assert.equal(captured.data.responseSnapshot,DbNull);assert.notEqual(captured.data.responseSnapshot,JsonNull);
});

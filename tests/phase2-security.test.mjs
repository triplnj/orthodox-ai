import assert from "node:assert/strict";
import fs from "node:fs";
import { mock, test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Live network calls forbidden in Phase 2 tests"); });
mock.method(console, "error", () => {});
const pro = { id: "user-1", email: "user@example.com", plan: "PRO", subscriptionStatus: "active", emailVerified: new Date() };
const free = { ...pro, plan: "FREE", subscriptionStatus: null };

function matches(record, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if (expected.in) return expected.in.includes(record[key]);
      if (expected.gte) return record[key] >= expected.gte;
      if (expected.gt) return record[key] > expected.gt;
    }
    return record[key] === expected;
  });
}

function harness({ user = pro, failModel = false, modelGate } = {}) {
  const state = { reservations: [], logs: [], jobs: [], modelCalls: 0, researchCalls: 0, dispatchCalls: 0,
    databaseUnavailable: false, failLog: false, sessionCalls: 0 };
  let queue = Promise.resolve();
  let sequence = 0;
  const reservations = {
    count: async ({ where }) => state.reservations.filter((row) => matches(row, where)).length,
    create: async ({ data }) => {
      const row = { id: `reservation-${++sequence}`, createdAt: new Date(), status: "RUNNING", ...data };
      state.reservations.push(row); return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = state.reservations.filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
    },
  };
  const usageLog = {
    count: async ({ where }) => state.logs.filter((row) => matches(row, where)).length,
    create: async ({ data }) => {
      if (state.failLog) throw new Error("Failed to persist usage");
      const row = { ...data, createdAt: new Date() }; state.logs.push(row); return row;
    },
  };
  const jobs = {
    findUnique: async ({ where }) => state.jobs.find((row) => matches(row, where)) ?? null,
    findFirst: async ({ where }) => state.jobs.find((row) => matches(row, where)) ?? null,
    create: async ({ data }) => {
      const row = { id: `job-${++sequence}`, claimToken: null, dispatchedAt: null, attempts: 0, ...data };
      state.jobs.push(row); return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = state.jobs.filter((row) => matches(row, where));
      for (const row of rows) for (const [key, value] of Object.entries(data)) {
        row[key] = value && typeof value === "object" && value.increment ? row[key] + value.increment : value;
      }
      return { count: rows.length };
    },
  };
  const prisma = { aiReservation: reservations, usageLog, patristicDiscoveryJob: jobs,
    user: { upsert: async () => ({ id: "review-user" }) },
    chatMessage: { create: async ({ data }) => data },
    journalEntry: { findFirst: async () => ({ id: "entry", content: "Reflection", title: "Title" }),
      update: async ({ data }) => ({ id: "entry", ...data }) },
    $transaction: async (work) => {
      if (state.databaseUnavailable) throw new Error("Database unavailable");
      let release;
      let snapshot;
      const tx = { ...prisma, $queryRaw: async (sql, key) => {
        assert.match(sql.join("?"), /pg_advisory_xact_lock/);
        assert.equal(typeof key, "string");
        const previous = queue;
        queue = new Promise((resolve) => { release = resolve; });
        await previous;
        snapshot = { reservations: state.reservations.map((row) => ({ ...row })), logs: [...state.logs], jobs: state.jobs.map((row) => ({ ...row })) };
        return [{ locked: 1 }];
      } };
      try { return await work(tx); }
      catch (error) { if (snapshot) Object.assign(state, snapshot); throw error; }
      finally { release?.(); }
    },
  };
  const load = createLoader({
    "server-only": {},
    "@/lib/prisma": { prisma },
    "pdf-parse": { PDFParse: class {} },
    "pdf-parse/worker": { CanvasFactory: class {} },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/session": { getSessionUser: async () => user, createSession: async () => { state.sessionCalls++; } },
    "@/lib/userProfileContext": { getUserProfileContext: async () => "Profile" },
    "@/lib/ai/chatService": { generateOrthodoxAnswer: async () => {
      state.modelCalls++;
      if (modelGate) await modelGate;
      if (failModel) throw new Error("Model unavailable");
      return { answer: "Answer" };
    } },
    "@/lib/patristics/build-patristic-research-context": { buildPatristicResearchContext: async () => { state.researchCalls++; return null; } },
    "workflow/api": { start: async () => { state.dispatchCalls++; return { runId: "workflow-run" }; } },
    "@/workflows/patristic-discovery": { patristicDiscoveryWorkflow: () => {} },
  }, { NODE_ENV: "test", PATRISTICS_SECRET: undefined, PATRISTICS_ADMIN_USER_IDS: "",
    ENABLE_PATRISTICS_TEST_ROUTES: undefined, REVIEW_ACCESS_TOKEN: "test-review-token", REVIEW_CLERGY_ACCESS_TOKEN: "test-clergy-token" });
  return { load, state, prisma };
}

function request(body = { message: "Question" }, headers = {}) {
  return new Request("https://example.com/api/test", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("simultaneous Free chat reservations cannot overspend the final daily credit", async () => {
  const { load, state } = harness({ user: free });
  for (let i = 0; i < 4; i++) state.logs.push({ userId: free.id, feature: "chat", createdAt: new Date() });
  const { reserveAiOperation } = load("src/lib/ai/operationLimits.ts");
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => reserveAiOperation(free.id, "chat", free)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(state.logs.length, 5);
  assert.equal(state.reservations.length, 1);
  assert.equal(results.find((result) => result.status === "fulfilled").value.remaining, 0);
});

test("Free and Pro chat preserve their daily allowances", async () => {
  for (const [user, limit] of [[free, 5], [pro, 100]]) {
    const { load, state } = harness({ user });
    for (let i = 0; i < limit; i++) state.logs.push({ userId: user.id, feature: "chat", createdAt: new Date(Date.now() - 120_000) });
    await assert.rejects(load("src/lib/ai/operationLimits.ts").reserveAiOperation(user.id, "chat", user),
      { status: 429, limitType: "daily", upgradeRequired: user.plan === "FREE" });
    assert.equal(state.reservations.length, 0);
  }
});

test("inactive Pro subscriptions keep the existing Free quota and cannot access paid AI", async () => {
  for (const subscriptionStatus of ["trialing", "on_trial", "paused", "canceled", "past_due"]) {
    const user = { ...pro, subscriptionStatus };
    const { load, state } = harness({ user });
    const { reserveAiOperation } = load("src/lib/ai/operationLimits.ts");
    await assert.rejects(reserveAiOperation(user.id, "prayer-plan", user), { status: 403 });
    for (let i = 0; i < 5; i++) state.logs.push({ userId: user.id, feature: "chat", createdAt: new Date(Date.now() - 120_000) });
    await assert.rejects(reserveAiOperation(user.id, "chat", user), { limitType: "daily" });
  }
});

test("chat and personal plans share the same per-user concurrency slot", async () => {
  const { load } = harness();
  const { reserveAiOperation } = load("src/lib/ai/operationLimits.ts");
  await reserveAiOperation(pro.id, "chat", pro);
  await assert.rejects(reserveAiOperation(pro.id, "prayer-plan", pro), { limitType: "concurrency" });
  await assert.doesNotReject(reserveAiOperation("other-user", "chat", { ...pro, id: "other-user" }));
});

test("failed operations are charged but release concurrency", async () => {
  const { load, state } = harness();
  const { withAiOperation } = load("src/lib/ai/operationLimits.ts");
  await assert.rejects(withAiOperation(pro.id, "chat", pro, async () => { throw new Error("failed"); }), /failed/);
  assert.equal(state.reservations[0].status, "FAILED");
  assert.equal(state.logs.length, 1);
  await withAiOperation(pro.id, "chat", pro, async () => "success");
  assert.equal(state.logs.length, 2);
  assert.equal(state.reservations[1].status, "COMPLETED");
});

test("usage persistence failure rolls back the reservation before expensive work", async () => {
  const { load, state } = harness();
  state.failLog = true;
  await assert.rejects(load("src/lib/ai/operationLimits.ts").withAiOperation(pro.id, "chat", pro, async () => { state.modelCalls++; }), /Failed to persist/);
  assert.equal(state.reservations.length, 0);
  assert.equal(state.modelCalls, 0);
});

test("shared rate limit and paid-feature daily budget reject requests before work", async () => {
  for (const [count, feature, expected] of [[10, "chat", "rate"], [30, "prayer-plan", "daily"]]) {
    const { load, state } = harness();
    for (let i = 0; i < count; i++) state.reservations.push({ subject: pro.id, feature: "prayer-plan", status: "COMPLETED",
      createdAt: new Date(Date.now() - (expected === "daily" ? 120_000 : 0)) });
    await assert.rejects(load("src/lib/ai/operationLimits.ts").reserveAiOperation(pro.id, feature, pro), { limitType: expected });
  }
});

test("expired crash leases stop blocking capacity", async () => {
  const { load, state } = harness();
  state.reservations.push({ subject: pro.id, feature: "chat", status: "RUNNING", createdAt: new Date(), expiresAt: new Date(Date.now() - 1) });
  await assert.doesNotReject(load("src/lib/ai/operationLimits.ts").reserveAiOperation(pro.id, "chat", pro));
});

const aiRoutes = [
  ["src/app/api/chat/route.ts", { message: "Question" }],
  ["src/app/api/pro/prayer-plan/route.ts", {}],
  ["src/app/api/pro/fasting-plan/route.ts", {}],
  ["src/app/api/pro/scripture-plan/route.ts", {}],
  ["src/app/api/journal/summarize/route.ts", { entryId: "entry" }],
];
for (const [file, body] of aiRoutes) {
  test(`${file}: anonymous callers never reach AI`, async () => {
    const { load, state } = harness({ user: null });
    assert.equal((await load(file).POST(request(body))).status, 401);
    assert.equal(state.modelCalls, 0);
    assert.equal(state.reservations.length, 0);
  });
  test(`${file}: paid calls reserve before AI and release after success`, async () => {
    const { load, state } = harness();
    const response = await load(file).POST(request(body));
    assert.equal(response.status, 200);
    assert.equal(state.modelCalls, 1);
    assert.equal(state.reservations[0].status, "COMPLETED");
  });
  if (!file.includes("/chat/")) test(`${file}: Free users cannot invoke paid AI`, async () => {
    const { load, state } = harness({ user: free });
    assert.equal((await load(file).POST(request(body))).status, 403);
    assert.equal(state.modelCalls, 0);
  });
}

test("simultaneous chat requests invoke research and generation only once", async () => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const { load, state } = harness({ modelGate: gate });
  const route = load("src/app/api/chat/route.ts");
  const first = route.POST(request());
  try {
    for (let attempts = 0; attempts < 50 && state.modelCalls === 0; attempts++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(state.modelCalls, 1, "the first operation must enter generation");
    const second = await route.POST(request());
    assert.equal(second.status, 429);
    assert.equal((await second.json()).limitType, "concurrency");
    assert.equal(state.researchCalls, 1);
  } finally { finish(); }
  assert.equal((await first).status, 200);
  assert.equal(state.modelCalls, 1);
});

test("provider failures return controlled errors, retain charges, and clear the active lease", async () => {
  const { load, state } = harness({ failModel: true });
  assert.equal((await load("src/app/api/chat/route.ts").POST(request())).status, 500);
  assert.equal(state.logs.length, 1);
  assert.equal(state.reservations[0].status, "FAILED");
});

test("database failure fails closed before research or generation", async () => {
  const { load, state } = harness();
  state.databaseUnavailable = true;
  assert.equal((await load("src/app/api/chat/route.ts").POST(request())).status, 500);
  assert.equal(state.modelCalls, 0);
  assert.equal(state.researchCalls, 0);
});

test("malformed and oversized AI bodies are rejected before reservation", async () => {
  const { load, state } = harness();
  const route = load("src/app/api/chat/route.ts");
  assert.equal((await route.POST(request({ message: "x".repeat(70_000) }))).status, 413);
  assert.equal((await route.POST(request({ message: "question", contextKey: "invalid" }))).status, 400);
  assert.equal(state.reservations.length, 0);
});

test("review token access is metered under one stable principal", async () => {
  const { load, state } = harness({ user: null });
  const route = load("src/app/api/review/chat/route.ts");
  assert.equal((await route.POST(request({ token: "wrong", message: "Question" }))).status, 401);
  assert.equal(state.reservations.length, 0);
  assert.equal((await route.POST(request({ token: "test-review-token", message: "Question" }))).status, 200);
  assert.equal(state.reservations[0].subject, "review:fr-josiah");
  for (let i = 0; i < 99; i++) state.reservations.push({ subject: "review:fr-josiah", feature: "review", status: "COMPLETED", createdAt: new Date(Date.now() - 120_000) });
  state.reservations[0].createdAt = new Date(Date.now() - 120_000);
  assert.equal((await route.POST(request({ token: "test-review-token", message: "Question" }))).status, 429);
});

for (const [review, token] of [["clergy", "test-clergy-token"], ["fr-josiah", "test-review-token"]]) {
  test(`${review} review-session creation requires its token and has a shared rate limit`, async () => {
    const { load, state } = harness({ user: null });
    const route = load(`src/app/api/review/${review}/start/route.ts`);
    const startRequest = (value) => ({ nextUrl: new URL(`https://example.com/review?token=${value}`), url: "https://example.com/review" });
    assert.equal((await route.GET(startRequest("wrong"))).status, 401);
    assert.equal(state.reservations.length, 0);
    assert.equal((await route.GET(startRequest(token))).status, 307);
    assert.equal(state.sessionCalls, 1);
    for (let i = 0; i < 9; i++) state.reservations.push({ subject: `review:${review}-start`, feature: "review", createdAt: new Date(), status: "COMPLETED" });
    assert.equal((await route.GET(startRequest(token))).status, 429);
    assert.equal(state.sessionCalls, 1);
  });
}

test("all patristics routes are wrapped; test routes are explicitly marked development-only", () => {
  const root = new URL("../src/app/api/patristics/", import.meta.url);
  const dirs = fs.readdirSync(root);
  assert.equal(dirs.length, 10);
  for (const name of dirs) {
    const text = fs.readFileSync(new URL(`${name}/route.ts`, root), "utf8");
    assert.match(text, /export const POST = secureResearchRoute\(handleResearch, (true|false)\)/);
    if (name.endsWith("-test")) assert.match(text, /secureResearchRoute\(handleResearch, true\)/);
    assert.doesNotMatch(text, /getCurrentUser/);
  }
});

for (const [name, user] of [["anonymous", null], ["ordinary", pro], ["unverified provisioned", { ...pro, emailVerified: null }]]) {
  test(`internal research rejects ${name} users before handler execution`, async () => {
    const { load, state } = harness({ user });
    load.environment.PATRISTICS_ADMIN_USER_IDS = name === "unverified provisioned" ? pro.id : "";
    const { secureResearchRoute } = load("src/lib/patristics/api-security.ts");
    let calls = 0;
    const route = secureResearchRoute(async () => { calls++; return Response.json({ ok: true }); });
    assert.equal((await route(request({ query: "Question" }))).status, user ? 403 : 401);
    assert.equal(calls, 0);
    assert.equal(state.reservations.length, 0);
  });
}

test("worker secrets and verified provisioned admins can use bounded internal research", async () => {
  for (const worker of [false, true]) {
    const { load, state } = harness({ user: worker ? null : pro });
    load.environment.PATRISTICS_SECRET = "test-worker-secret";
    load.environment.PATRISTICS_ADMIN_USER_IDS = pro.id;
    const { secureResearchRoute } = load("src/lib/patristics/api-security.ts");
    const route = secureResearchRoute(async () => Response.json({ ok: true }));
    const response = await route(request({ query: "Question" }, worker ? { "x-patristics-secret": "test-worker-secret" } : {}));
    assert.equal(response.status, 200);
    assert.equal(state.reservations.length, 1);
  }
});

test("development research routes return 404 in production before authentication or work", async () => {
  const { load, state } = harness();
  load.environment.NODE_ENV = "production";
  const route = load("src/lib/patristics/api-security.ts").secureResearchRoute(async () => { throw new Error("must not run"); }, true);
  assert.equal((await route(request({ query: "Question" }))).status, 404);
  assert.equal(state.reservations.length, 0);
});

test("every research API rejects anonymous and ordinary users through its actual exported handler", async () => {
  const publicRoot = new URL("../src/app/api/patristics/", import.meta.url);
  const adminRoot = new URL("../src/app/api/admin/patristics/", import.meta.url);
  const files = [
    ...fs.readdirSync(publicRoot).map((name) => `src/app/api/patristics/${name}/route.ts`),
    ...fs.readdirSync(adminRoot).map((name) => `src/app/api/admin/patristics/${name}/route.ts`),
  ];
  for (const user of [null, pro]) {
    const { load, state } = harness({ user });
    for (const file of files) {
      const response = await load(file).POST(request({ query: "Question", jobId: "job" }));
      assert.equal(response.status, user ? 403 : 401, file);
    }
    assert.equal(state.reservations.length, 0);
    assert.equal(state.dispatchCalls, 0);
    assert.equal(state.modelCalls, 0);
  }
});

test("production test-route override never bypasses research authorization", async () => {
  const { load } = harness();
  load.environment.NODE_ENV = "production";
  load.environment.ENABLE_PATRISTICS_TEST_ROUTES = "true";
  const route = load("src/lib/patristics/api-security.ts").secureResearchRoute(async () => { throw new Error("must not run"); }, true);
  assert.equal((await route(request({ query: "Question" }))).status, 403);
});

test("trusted maintenance calls without a body retain their existing request contract", async () => {
  const { load, state } = harness({ user: null });
  load.environment.PATRISTICS_SECRET = "test-worker-secret";
  const route = load("src/lib/patristics/api-security.ts").secureResearchRoute(async () => Response.json({ ok: true }));
  const response = await route(new Request("https://example.com/api/test", { method: "POST", headers: { "x-patristics-secret": "test-worker-secret" } }));
  assert.equal(response.status, 200);
  assert.equal(state.reservations.length, 1);
});

test("atomic claims admit only one competing owner and reject unrelated resumes", async () => {
  const { load, state } = harness();
  state.jobs.push({ id: "job", status: "PENDING", claimToken: null, attempts: 0 });
  const { claimPatristicJob, finishPatristicJob } = load("src/lib/patristics/job-claims.ts");
  const results = await Promise.all([claimPatristicJob("job", "owner-a"), claimPatristicJob("job", "owner-b")]);
  assert.deepEqual(results, [true, false]);
  assert.equal(state.jobs[0].attempts, 1);
  assert.equal(await claimPatristicJob("job", "owner-b", true), false);
  assert.equal(await claimPatristicJob("job", "owner-a", true), true);
  await finishPatristicJob("job", "owner-b", "cannot corrupt owner-a");
  assert.equal(state.jobs[0].status, "PROCESSING");
  await finishPatristicJob("job", "owner-a");
  assert.equal(state.jobs[0].status, "COMPLETED");
  assert.equal(await claimPatristicJob("job", "owner-a", true), false);
});

test("concurrent enqueue requests share a job while different languages remain separate", async () => {
  const { load, state } = harness();
  const { enqueuePatristicDiscovery } = load("src/lib/patristics/enqueue-discovery.ts");
  const results = await Promise.all(Array.from({ length: 8 }, () => enqueuePatristicDiscovery({ query: " Question ", language: "en" })));
  assert.equal(new Set(results.map((row) => row.id)).size, 1);
  await enqueuePatristicDiscovery({ query: "Question", language: "sr" });
  assert.equal(state.jobs.length, 2);
});

test("concurrent dispatch requests schedule only one durable workflow", async () => {
  const { load, state } = harness();
  state.jobs.push({ id: "job", query: "Question", language: "en", status: "PENDING", dispatchedAt: null });
  const { dispatchPatristicJob } = load("src/lib/patristics/dispatch-job.ts");
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => dispatchPatristicJob("job")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(state.dispatchCalls, 1);
});

test("failed job completion retains the owning claim and never permits automatic duplicate work", async () => {
  const { load, state } = harness();
  state.jobs.push({ id: "job", status: "PENDING", claimToken: null, attempts: 0 });
  const { claimPatristicJob, finishPatristicJob } = load("src/lib/patristics/job-claims.ts");
  await claimPatristicJob("job", "owner");
  await finishPatristicJob("job", "owner", "provider failed");
  assert.equal(state.jobs[0].status, "FAILED");
  assert.equal(state.jobs[0].error, "provider failed");
  assert.equal(await claimPatristicJob("job", "other"), false);
});

test("dispatch failure remains fenced instead of silently scheduling the same job twice", async () => {
  const { state, prisma } = harness();
  state.jobs.push({ id: "job", query: "Question", language: "en", status: "PENDING", dispatchedAt: null });
  let attempts = 0;
  const load = createLoader({
    "server-only": {}, "@/lib/prisma": { prisma },
    "workflow/api": { start: async () => { attempts++; throw new Error("Ambiguous scheduling failure"); } },
    "@/workflows/patristic-discovery": { patristicDiscoveryWorkflow: () => {} },
  });
  const { dispatchPatristicJob } = load("src/lib/patristics/dispatch-job.ts");
  await assert.rejects(dispatchPatristicJob("job"), /Ambiguous scheduling failure/);
  await assert.rejects(dispatchPatristicJob("job"), { status: 409 });
  assert.equal(attempts, 1);
  assert.ok(state.jobs[0].dispatchedAt);
});

test("direct processor performs discovery once and records failure under its owning claim", async () => {
  const { state, prisma } = harness();
  state.jobs.push({ id: "job", query: "Question", language: "en", status: "PENDING", claimToken: null, attempts: 0 });
  let calls = 0;
  const load = createLoader({
    "server-only": {}, "@/lib/prisma": { prisma },
    "./discover-and-save": { discoverAndSavePatristicQuotes: async () => { calls++; throw new Error("Provider failed"); } },
    "./verify-second-source": {}, "./embed-quotes": {},
  });
  const { processPatristicDiscoveryJob } = load("src/lib/patristics/process-discovery-job.ts");
  await assert.rejects(processPatristicDiscoveryJob("job"), /Provider failed/);
  const second = await processPatristicDiscoveryJob("job");
  assert.equal(second.processed, false);
  assert.equal(calls, 1);
  assert.equal(state.jobs[0].status, "FAILED");
});

test("durable workflow uses run ownership and never reruns a completed discovery job", async () => {
  const { state, prisma } = harness();
  state.jobs.push({ id: "job", query: "Question", language: "en", status: "PENDING", claimToken: null, attempts: 0 });
  let calls = 0;
  const mocks = Object.fromEntries([
    "fetch-source", "extract-quotes", "verify", "trusted-sources", "verify-attribution",
    "save-quotes", "backfill-translations", "verify-second-source", "embed-quotes",
  ].map((name) => [`@/lib/patristics/${name}`, {}]));
  const load = createLoader({
    ...mocks, "server-only": {}, "@/lib/prisma": { prisma },
    workflow: { getWorkflowMetadata: () => ({ workflowRunId: "durable-owner" }) },
    "@/lib/patristics/discover-and-save": { discoverPatristicSourceUrls: async () => { calls++; return { discovered: 0, sourceUrls: [] }; } },
  });
  const { patristicDiscoveryWorkflow } = load("src/workflows/patristic-discovery.ts");
  assert.equal((await patristicDiscoveryWorkflow("job", "Question", "en")).processed, true);
  assert.equal(state.jobs[0].claimToken, "durable-owner");
  assert.equal(state.jobs[0].status, "COMPLETED");
  assert.equal((await patristicDiscoveryWorkflow("job", "Question", "en")).processed, false);
  assert.equal(calls, 1);
});

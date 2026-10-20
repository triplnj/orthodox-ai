import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLoader } from "./helpers/load-ts.mjs";

// This suite cannot consume DATABASE_URL or connect to another server. It also
// checks the server's physical data directory before creating any database.
const root = fs.readFileSync(path.join(os.tmpdir(), "orthodoxai-phase8-location.txt"), "utf8").trim().replace(/^\uFEFF/, "");
assert.ok(path.basename(root).startsWith("orthodoxai-phase8-postgres-"));
const config = { host: "127.0.0.1", port: 55483, user: "phase8", password: "", ssl: false, connectionTimeoutMillis: 3000, max: 16 };
const database = `phase8_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const admin = new pg.Pool({ ...config, database: "postgres" });
let pool, prisma, load, limits, turns, personal, auth, billing, jobs;
const subscriptions = new Map(); let cancelFails = false;
const migrationRoot = "prisma/migrations";
const migrations = fs.readdirSync(migrationRoot).filter(name => fs.existsSync(path.join(migrationRoot, name, "migration.sql"))).sort();
const vectorMigrations = new Set(["20260901151508_add_patristic_embeddings", "20260901151756_add_patristic_embeddings", "20260901160101_restore_patristic_embedding"]);
const sql = name => fs.readFileSync(path.join(migrationRoot, name, "migration.sql"), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
mock.method(globalThis, "fetch", () => { throw new Error("Live service calls forbidden"); });
const legacy = `legacy_${randomUUID()}`;
let vectorAvailable = false;
const rawMigrationFailures = [];
let created = false, databaseOid;
const pidLines = fs.readFileSync(path.join(root, "data/postmaster.pid"), "utf8").split(/\r?\n/);
async function assertInstance() {
  const actual = (await admin.query("SHOW data_directory")).rows[0].data_directory;
  assert.equal(path.resolve(actual), path.resolve(root, "data"), "Refuse any existing/foreign cluster");
  assert.match((await admin.query("SELECT version() AS version")).rows[0].version, /PostgreSQL 17\.11/);
  const row = (await admin.query("SELECT host(inet_server_addr()) AS address, inet_server_port() AS port, floor(extract(epoch from pg_postmaster_start_time()))::bigint::text AS started")).rows[0];
  assert.equal(row.address, "127.0.0.1"); assert.equal(row.port, 55483); assert.equal(row.started, pidLines[2]); assert.equal(pidLines[0], "13460"); assert.equal(pidLines[3], "55483");
  assert.equal(fs.readFileSync(path.join(root, "data/postmaster.pid"), "utf8").split(/\r?\n/)[0], pidLines[0]);
}
before(async () => {
  await assertInstance();
  assert.ok(/^phase8_[a-f0-9]{12}$/.test(database));
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount, 0);
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  databaseOid = (await admin.query("SELECT oid FROM pg_database WHERE datname=$1", [database])).rows[0].oid;
  pool = new pg.Pool({ ...config, database });
  vectorAvailable = Boolean((await pool.query("SELECT 1 FROM pg_available_extensions WHERE name='vector'")).rowCount);
  for (const migration of migrations.filter(name => name < "20261017000000")) {
    if (!vectorAvailable && vectorMigrations.has(migration)) continue;
    await pool.query(sql(migration));
  }
  await pool.query('INSERT INTO "users" (id,email,plan,"subscriptionStatus","subscriptionId","lemonSqueezySubscriptionId","updatedAt") VALUES ($1,$2,\'PRO\',\'active\',\'synthetic-stripe\',\'synthetic-lemon\',NOW())', [legacy, `${legacy}@example.test`]);
  await pool.query('INSERT INTO chat_messages(id,"userId",role,content) VALUES ($1,$2,\'assistant\',\'Legacy answer\')', [`message_${legacy}`, legacy]);
  for (const migration of migrations.filter(name => name >= "20261017000000")) {
    try { await pool.query(sql(migration)); }
    catch (error) {
      // Diagnostic continuation only: do not change the on-disk migration or
      // hide its failed raw-SQL replay. Keep that as a failing release check.
      if (error.code !== "42601" || !sql(migration).startsWith("\uFEFF")) throw error;
      rawMigrationFailures.push({ migration, code: error.code, reason: "UTF-8 BOM rejected by PostgreSQL" });
      await pool.query("ROLLBACK"); await pool.query(sql(migration).slice(1));
    }
  }
  console.log(`NATIVE_POSTGRES=17.11; pending migration fixture=${migrations.filter(name => name >= "20261017000000").join(",")}; BOM normalizations=${rawMigrationFailures.length}; pgvector=${vectorAvailable}; independent pool connections enabled`);
  const generated = createLoader()("src/generated/prisma/client.ts");
  prisma = new generated.PrismaClient({ adapter: new PrismaPg(pool) });
  const providerMocks = {
    retrieve: async (provider, id) => { const found = subscriptions.get(`${provider}:${id}`); if (!found) throw new Error("Synthetic provider unavailable"); return { ...found }; },
    inventory: async (provider, customer) => [...subscriptions.values()].filter(row => row.provider === provider && row.providerCustomerId === customer).map(row => ({ ...row })),
    terminal: row => ["canceled", "cancelled", "expired", "incomplete_expired"].includes(row.status),
    cancel: async row => { if (cancelFails) throw new Error("Synthetic cancellation failure"); subscriptions.set(`${row.provider}:${row.providerSubscriptionId}`, { ...row, status: row.provider === "STRIPE" ? "canceled" : "cancelled", providerUpdatedAt: new Date() }); },
    assertNoDebt: async () => {}, checkoutClosed: async () => false,
    createCheckout: async () => { throw new Error("Synthetic uncertain checkout"); },
  };
  // Preserve the real BillingError identity while mocking only provider I/O.
  const providerTypes = createLoader({ "server-only": {} })("src/lib/billing/providers.ts");
  load = createLoader({ "server-only": {}, "@/lib/prisma": { prisma }, "@/generated/prisma/client": generated,
    "./providers": { ...providerTypes, ...providerMocks },
    "next/headers": { cookies: async () => ({ get() {}, set() {}, delete() {} }) },
    "@/lib/email": { sendEmailVerification: async () => {}, sendPasswordResetEmail: async () => {} },
  }, { NODE_ENV: "test", AI_QUOTA_TIMEZONE: "UTC", BILLING_ADMIN_USER_IDS: "synthetic-admin", AUTH_RATE_LIMIT_SECRET: "synthetic-test-only-secret-32-characters-long" });
  limits = load("src/lib/ai/operationLimits.ts"); turns = load("src/lib/chat/conversations.ts"); personal = load("src/lib/ai/personalRequests.ts");
  auth = load("src/lib/security/auth-service.ts"); billing = load("src/lib/billing/service.ts"); jobs = load("src/lib/patristics/job-claims.ts");
}, { timeout: 30000 });
after(async () => {
  try { await prisma?.$disconnect(); await pool?.end(); }
  finally {
    try {
      if (created) {
        await assertInstance(); assert.ok(/^phase8_[a-f0-9]{12}$/.test(database));
        assert.equal((await admin.query("SELECT oid FROM pg_database WHERE datname=$1", [database])).rows[0]?.oid, databaseOid);
        await admin.query(`DROP DATABASE "${database}"`); console.log(`NATIVE_CLEANUP=DELETED; database=${database}`);
      }
    } finally { await admin.end(); }
  }
}, { timeout: 10000 });
async function user(plan = "FREE", extras = {}) {
  const id = randomUUID();
  return prisma.user.create({ data: { id, email: `${id}@example.test`, emailVerified: new Date(), plan,
    subscriptionStatus: plan === "PRO" ? "active" : null, ...extras } });
}
async function charge(user, count) {
  // Boundary fixtures must be outside the separate per-minute rate window.
  await prisma.usageLog.createMany({ data: Array.from({ length: count }, () => ({ userId: user.id, feature: "chat", createdAt: new Date(Date.now() - 120000) })) });
}
async function finish(id) { await prisma.aiReservation.update({ where: { id }, data: { status: "COMPLETED", finishedAt: new Date() } }); }
function subscription(user, provider = "LEMONSQUEEZY", overrides = {}) {
  return { provider, providerSubscriptionId: `sub-${user.id}`, providerCustomerId: `customer-${user.id}`, providerProductId: "synthetic-product", status: "active",
    currentPeriodEndsAt: new Date(Date.now() + 86400000), trialEndsAt: null, cancelAtPeriodEnd: false, providerUpdatedAt: new Date(), paidVerified: true, ...overrides };
}
async function billingFixture(provider = "LEMONSQUEEZY", overrides = {}) {
  const u = await user("PRO"); const s = subscription(u, provider, overrides); subscriptions.set(`${provider}:${s.providerSubscriptionId}`, s);
  await prisma.user.update({ where: { id: u.id }, data: provider === "STRIPE" ? { subscriptionId: s.providerSubscriptionId, stripeCustomerId: s.providerCustomerId } : { lemonSqueezySubscriptionId: s.providerSubscriptionId, lemonSqueezyCustomerId: s.providerCustomerId } });
  return { u, s, notice: { provider, eventId: randomUUID(), eventType: "synthetic", subscriptionId: s.providerSubscriptionId, customerId: s.providerCustomerId, userId: u.id, rawBody: "synthetic-event" } };
}

test("raw pending migration replay preserves legacy data and has no migration failures", async () => {
  const u = await prisma.user.findUnique({ where: { id: legacy } }); assert.equal(u.plan, "PRO"); assert.equal(u.subscriptionId, "synthetic-stripe"); assert.equal(u.lemonSqueezySubscriptionId, "synthetic-lemon");
  assert.equal(await prisma.billingSubscription.count({ where: { userId: legacy, status: "unverified_legacy" } }), 2);
  const m = await prisma.chatMessage.findFirst({ where: { userId: legacy } }); assert.equal(m.conversationId, null); assert.equal(m.content, "Legacy answer");
  assert.deepEqual(rawMigrationFailures, [], "Raw migration failures are release findings; subsequent tests use a BOM-normalized diagnostic fixture only");
});
test("complete historical pgvector migration replay", t => { if (!vectorAvailable) t.skip("Official vanilla PostgreSQL lacks pgvector; three historical vector migrations omitted from synthetic fixture only. Full extension-dependent replay is unverified."); });
test("advisory locks exclude a genuinely independent PostgreSQL backend until commit", async () => {
  const first = await pool.connect(), second = await pool.connect();
  try {
    assert.notEqual((await first.query("SELECT pg_backend_pid() AS pid")).rows[0].pid, (await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    await first.query("BEGIN"); await first.query("SELECT pg_advisory_xact_lock(81372001)");
    assert.equal((await second.query("SELECT pg_try_advisory_xact_lock(81372001) AS acquired")).rows[0].acquired, false);
    await first.query("COMMIT"); assert.equal((await second.query("SELECT pg_try_advisory_xact_lock(81372001) AS acquired")).rows[0].acquired, true);
  } finally { await first.query("ROLLBACK"); first.release(); second.release(); }
});
for (const [plan, boundary] of [["FREE", 5], ["PRO", 100]]) test(`${plan}: concurrent final-credit admissions have one winner and reject the next request`, async () => {
  const u = await user(plan); await charge(u, boundary - 1);
  const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => limits.reserveAiOperation(u.id, "chat", u)));
  const winners = outcomes.filter(row => row.status === "fulfilled"); assert.equal(winners.length, 1); assert.equal(winners[0].value.remaining, 0); await finish(winners[0].value.id);
  await assert.rejects(limits.reserveAiOperation(u.id, "chat", u), error => error.limitType === "daily");
  assert.equal(await prisma.usageLog.count({ where: { userId: u.id } }), boundary);
});
test("failed operations retain one charge and release the active concurrency slot", async () => {
  const u = await user(); await assert.rejects(limits.withAiOperation(u.id, "chat", u, async () => { throw new Error("Synthetic provider failure"); }));
  assert.equal(await prisma.usageLog.count({ where: { userId: u.id } }), 1); assert.equal((await prisma.aiReservation.findFirst({ where: { subject: u.id } })).status, "FAILED");
  const next = await limits.reserveAiOperation(u.id, "chat", u); await finish(next.id);
});
test("concurrent same-key ChatTurn creation has one durable winner", async () => {
  const u = await user(); const input = { message: "Question", contextKey: "general", requestId: randomUUID() };
  const outcomes = await Promise.allSettled([turns.beginTurn(u.id, input), turns.beginTurn(u.id, input)]); assert.equal(outcomes.filter(row => row.status === "fulfilled").length, 1); assert.equal(await prisma.chatTurn.count({ where: { userId: u.id } }), 1);
});
test("turn recovery fences old dispatch and completion writes", async () => {
  const u = await user(); const { turn } = await turns.beginTurn(u.id, { message: "Question", contextKey: "general", requestId: randomUUID() });
  await turns.dispatchTurn(turn); await turns.recoverTurn(u.id, turn.conversationId, turn.id);
  await assert.rejects(turns.completeTurn(turn, "general", { answer: "Stale" }, [], null, {})); assert.equal(await prisma.chatMessage.count({ where: { userId: u.id } }), 0);
});
test("conversation composite foreign keys reject cross-user message attachment", async () => {
  const a = await user(), b = await user(); const { turn } = await turns.beginTurn(a.id, { message: "Question", contextKey: "general", requestId: randomUUID() });
  await assert.rejects(prisma.chatMessage.create({ data: { userId: b.id, conversationId: turn.conversationId, turnId: turn.id, role: "assistant", content: "Foreign" } }));
});
test("source snapshots persist against the correct answer and reject updates", async () => {
  const u = await user(); const { turn } = await turns.beginTurn(u.id, { message: "Question", contextKey: "general", requestId: randomUUID() });
  const source = { provider: "WEB_RESEARCH", authorName: null, workTitle: null, reference: "Exact reference", originalLanguage: null, sourceUrl: "https://example.test/work#passage", scanUrl: null, verificationStatus: "LIVE_WEB_RESEARCH", includedInContext: true, claimMappings: [] };
  await turns.completeTurn(turn, "general", { answer: "Saved" }, [source], "Evidence", {});
  const row = await prisma.chatMessageSource.findFirst({ where: { message: { userId: u.id } }, include: { message: true } }); assert.equal(row.message.role, "assistant"); assert.equal(row.snapshot.sourceUrl, source.sourceUrl);
  await assert.rejects(prisma.chatMessageSource.update({ where: { id: row.id }, data: { reference: "Altered" } }));
  await assert.rejects(prisma.chatTurn.update({ where: { id: turn.id }, data: { question: "Changed" } }));
});
test("personal-operation replay calls work once and retains one quota charge", async () => {
  const u = await user("PRO"); let calls = 0; const body = { requestId: randomUUID(), focus: "Synthetic" }; const work = async () => { calls++; return Response.json({ plan: "Saved plan" }); };
  await personal.runPersonalRequest(u, "prayer-plan", body, work); const replay = await (await personal.runPersonalRequest(u, "prayer-plan", body, work)).json();
  assert.equal(calls, 1); assert.equal(replay.replayed, true); assert.equal(replay.quota.used, 1);
});
test("simultaneous personal-operation retries invoke work once", async () => {
  const u = await user("PRO"); let release, calls = 0; const gate = new Promise(resolve => { release = resolve; }); const body = { requestId: randomUUID() };
  const first = personal.runPersonalRequest(u, "prayer-plan", body, async () => { calls++; await gate; return Response.json({ plan: "Saved" }); });
  for (let i = 0; i < 100 && calls === 0; i++) await new Promise(resolve => setTimeout(resolve, 5));
  const second = await Promise.allSettled([personal.runPersonalRequest(u, "prayer-plan", body, async () => { calls++; return Response.json({ plan: "Duplicate" }); })]); release(); await first;
  assert.equal(second[0].status, "rejected"); assert.equal(calls, 1);
});
test("personal recovery fences stale completion, retains accounting and releases its lease", async () => {
  const u = await user("PRO"); let release, called = false; const gate = new Promise(resolve => { release = resolve; }); const body = { requestId: randomUUID() };
  const operation = personal.runPersonalRequest(u, "prayer-plan", body, async () => { called = true; await gate; return Response.json({ plan: "Stale" }); });
  const outcome = Promise.allSettled([operation]); for (let i = 0; i < 100 && !called; i++) await new Promise(resolve => setTimeout(resolve, 5));
  await personal.recoverPersonalRequest(u, "prayer-plan", body.requestId); release(); assert.equal((await outcome)[0].status, "rejected");
  const row = await prisma.aiReservation.findFirst({ where: { userId: u.id } }); assert.equal(row.status, "ABANDONED"); assert.equal(row.responseSnapshot, null); assert.ok(row.expiresAt <= new Date()); assert.equal((await limits.quotaSnapshot(u.id, "prayer-plan", u)).used, 1);
});
test("native retention trigger erases only expired payloads and keeps request identity", async () => {
  const u = await user("PRO"); const key = randomUUID();
  await prisma.aiReservation.create({ data: { subject: u.id, userId: u.id, feature: "prayer-plan", requestKey: key, requestHash: "a".repeat(64), status: "COMPLETED", responseSnapshot: { plan: "Private" }, finishedAt: new Date(Date.now() - 8 * 86400000), expiresAt: new Date() } });
  await personal.cleanupPrivateResponses(u.id); const row = await prisma.aiReservation.findFirst({ where: { userId: u.id } }); assert.equal(row.status, "RESULT_EXPIRED"); assert.equal(row.requestKey, key); assert.equal(row.responseSnapshot, null);
});
test("concurrent reset-token consumption has one winner, revokes sessions and invalidates sibling tokens", async () => {
  const u = await user(); const mail = await auth.issueEmail(u.id, "reset"); await auth.issueEmail(u.id, "reset");
  await prisma.session.create({ data: { userId: u.id, token: randomUUID(), expiresAt: new Date(Date.now() + 86400000) } });
  const outcomes = await Promise.allSettled([auth.consumeToken(mail.rawToken, "Synthetic-password-1"), auth.consumeToken(mail.rawToken, "Synthetic-password-2")]);
  assert.equal(outcomes.filter(row => row.status === "fulfilled").length, 1); assert.equal(await prisma.session.count({ where: { userId: u.id } }), 0); assert.equal(await prisma.passwordResetToken.count({ where: { userId: u.id, usedAt: null } }), 0);
});
for (const provider of ["LEMONSQUEEZY", "STRIPE"]) test(`${provider}: simultaneous webhook replays create one receipt and one entitlement record`, async () => {
  const { u, notice } = await billingFixture(provider); await Promise.all([billing.webhook(notice), billing.webhook(notice)]);
  assert.equal(await prisma.billingWebhookEvent.count({ where: { provider, eventId: notice.eventId } }), 1); assert.equal(await prisma.billingSubscription.count({ where: { userId: u.id } }), 1); assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).plan, "PRO");
});
test("older provider snapshots cannot overwrite a newer subscription state", async () => {
  const { u, s, notice } = await billingFixture(); await billing.webhook(notice);
  subscriptions.set(`${s.provider}:${s.providerSubscriptionId}`, { ...s, status: "expired", currentPeriodEndsAt: new Date(0), providerUpdatedAt: new Date(s.providerUpdatedAt.getTime() - 10000) });
  await billing.webhook({ ...notice, eventId: randomUUID(), rawBody: "older-event" }); assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).plan, "PRO");
});
test("verified trials retain access without being marked paid", async () => {
  const { u, notice } = await billingFixture("LEMONSQUEEZY", { status: "on_trial", paidVerified: false, trialEndsAt: new Date(Date.now() + 86400000) }); await billing.webhook(notice);
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).plan, "PRO"); assert.equal((await prisma.billingSubscription.findFirst({ where: { userId: u.id } })).paidVerified, false);
});
test("failed subscription cancellation retains the user and committed deletion fence", async () => {
  const { u } = await billingFixture(); cancelFails = true;
  try { await assert.rejects(billing.deleteAccount(u.id)); const row = await prisma.user.findUnique({ where: { id: u.id } }); assert.ok(row.billingDeletionRequestedAt); }
  finally { cancelFails = false; }
});
test("uncertain checkout prevents a second checkout through the durable database fence", async () => {
  const u = await user(); await assert.rejects(billing.checkout(u.id, "LEMONSQUEEZY")); await assert.rejects(billing.checkout(u.id, "STRIPE"));
  assert.equal(await prisma.billingCheckoutAttempt.count({ where: { userId: u.id } }), 1); assert.equal((await prisma.billingCheckoutAttempt.findFirst({ where: { userId: u.id } })).status, "UNKNOWN");
});
test("cross-provider pending-checkout uniqueness is enforced by PostgreSQL", async () => {
  const u = await user(); const results = await Promise.allSettled([prisma.billingCheckoutAttempt.create({ data: { userId: u.id, provider: "STRIPE" } }), prisma.billingCheckoutAttempt.create({ data: { userId: u.id, provider: "LEMONSQUEEZY" } })]); assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
});
test("atomic research job claiming has one owner and refuses stale completion", async () => {
  const job = await prisma.patristicDiscoveryJob.create({ data: { query: "Synthetic", language: "en" } });
  const claims = await Promise.all([jobs.claimPatristicJob(job.id, "owner-a"), jobs.claimPatristicJob(job.id, "owner-b")]); assert.equal(claims.filter(Boolean).length, 1);
  const current = await prisma.patristicDiscoveryJob.findUnique({ where: { id: job.id } }); await jobs.finishPatristicJob(job.id, "foreign-owner"); assert.equal((await prisma.patristicDiscoveryJob.findUnique({ where: { id: job.id } })).status, "PROCESSING"); await jobs.finishPatristicJob(job.id, current.claimToken);
});
test("user deletion cascades private data and preserves detached billing tombstones", async () => {
  const { u, notice } = await billingFixture(); await billing.webhook(notice);
  const { turn } = await turns.beginTurn(u.id, { message: "Private", contextKey: "general", requestId: randomUUID() }); await turns.completeTurn(turn, "general", { answer: "Private answer" }, [], null, {});
  await personal.runPersonalRequest(u, "prayer-plan", { requestId: randomUUID() }, async () => Response.json({ plan: "Private plan" })); await billing.deleteAccount(u.id);
  assert.equal(await prisma.user.count({ where: { id: u.id } }), 0); assert.equal(await prisma.chatTurn.count({ where: { userId: u.id } }), 0); assert.equal(await prisma.aiReservation.count({ where: { userId: u.id } }), 0);
  const tombstone = await prisma.billingSubscription.findFirst({ where: { providerSubscriptionId: notice.subscriptionId } }); assert.equal(tombstone.userId, null); assert.ok(tombstone.retainedUntil > new Date());
});
test("a transaction failure rolls back data and releases transaction-scoped advisory locks", async () => {
  const u = await user(); await assert.rejects(prisma.$transaction(async tx => { await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(81372002)`; await tx.user.update({ where: { id: u.id }, data: { name: "Must rollback" } }); throw new Error("Synthetic rollback"); }));
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).name, null); assert.equal((await pool.query("SELECT pg_try_advisory_xact_lock(81372002) AS acquired")).rows[0].acquired, true); await tick();
});
function bindReview(kind, id, email) {
  if (kind === "clergy") { load.environment.REVIEW_CLERGY_USER_ID = id; load.environment.REVIEW_CLERGY_USER_EMAIL = email; load.environment.REVIEW_CLERGY_ACCESS_TOKEN = "synthetic-clergy-token"; }
  else { load.environment.REVIEW_USER_ID = id; load.environment.REVIEW_USER_EMAIL = email; load.environment.REVIEW_ACCESS_TOKEN = "synthetic-review-token"; }
}
async function accountSnapshot(id) {
  return { user: await prisma.user.findUnique({ where: { id } }), sessions: await prisma.session.findMany({ where: { userId: id }, orderBy: { id: "asc" } }),
    resets: await prisma.passwordResetToken.findMany({ where: { userId: id }, orderBy: { id: "asc" } }), verifications: await prisma.emailVerificationToken.findMany({ where: { userId: id }, orderBy: { id: "asc" } }),
    messages: await prisma.chatMessage.findMany({ where: { userId: id }, orderBy: { id: "asc" } }) };
}
for (const kind of ["fr-josiah", "clergy"]) {
  test(`${kind}: native preclaim rejection leaves the entire collision account unchanged`, async () => {
    const email = `preclaim-${randomUUID()}@example.test`;
    const preclaimed = await auth.register(email, "Synthetic preclaim", "Synthetic-known-password-1");
    await auth.issueEmail(preclaimed, "reset"); await auth.issueEmail(preclaimed, "verify");
    await prisma.session.create({ data: { userId: preclaimed, token: randomUUID(), expiresAt: new Date(Date.now() + 600000) } });
    await prisma.chatMessage.create({ data: { userId: preclaimed, role: "user", content: "Do not transfer this data" } });
    const boundId = randomUUID(); bindReview(kind, boundId, email);
    const before = await accountSnapshot(preclaimed);
    const route = load(`src/app/api/review/${kind}/start/route.ts`);
    const token = kind === "clergy" ? "synthetic-clergy-token" : "synthetic-review-token";
    const response = await route.GET(new Request(`https://example.test/api/review/${kind}/start?token=${token}`));
    assert.equal(response.status, 409); assert.deepEqual(await accountSnapshot(preclaimed), before);
    assert.equal(await prisma.user.findUnique({ where: { id: boundId } }), null);
  });
  test(`${kind}: native concurrent registration and provisioning produce one passwordless identity`, async () => {
    const id = randomUUID(), email = `dedicated-${randomUUID()}@example.test`; bindReview(kind, id, email);
    const review = load("src/lib/security/review-provisioning.ts");
    const attempts = await Promise.all([auth.register(email, "Preclaim", "Synthetic-password-1"), ...Array.from({ length: 4 }, () => review.startReviewSession(kind))]);
    assert.equal(attempts[0], null); assert.equal(await prisma.user.count({ where: { email } }), 1);
    const current = await prisma.user.findUnique({ where: { id } }); assert.equal(current.passwordHash, null); assert.equal(current.plan, "PRO");
    assert.equal(await prisma.session.count({ where: { userId: id } }), 4);
  });
  test(`${kind}: native authorized legacy transition revokes sessions and tokens atomically`, async () => {
    const u = await user("PRO", { passwordHash: null });
    const mail = await auth.issueEmail(u.id, "reset");
    await prisma.emailVerificationToken.create({ data: { userId: u.id, tokenHash: auth.hashToken(randomUUID()), expiresAt: new Date(Date.now() + 600000) } });
    await prisma.session.create({ data: { userId: u.id, token: randomUUID(), expiresAt: new Date(Date.now() + 600000) } });
    bindReview(kind, u.id, u.email); const before = await prisma.user.findUnique({ where: { id: u.id } });
    const review = load("src/lib/security/review-provisioning.ts");
    await review.transitionLegacyReviewIdentity(kind, { actor: "synthetic-operator", reference: "approved-synthetic-transition", confirmUserId: u.id });
    assert.equal(await prisma.session.count({ where: { userId: u.id } }), 0);
    assert.equal(await prisma.passwordResetToken.count({ where: { userId: u.id, usedAt: null } }), 0);
    assert.equal(await prisma.emailVerificationToken.count({ where: { userId: u.id, usedAt: null } }), 0);
    await assert.rejects(auth.consumeToken(mail.rawToken, "Synthetic-new-password-1"));
    assert.deepEqual(await prisma.user.findUnique({ where: { id: u.id } }), before);
    await review.startReviewSession(kind); assert.equal(await prisma.session.count({ where: { userId: u.id } }), 1);
  });
}

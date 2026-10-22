import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";
import ts from "typescript";
import { createLoader } from "./helpers/load-ts.mjs";
import { phase6Harness } from "./helpers/phase6-harness.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Live service calls forbidden"); });
const load = createLoader({ "server-only": {} }, { REVIEW_USER_ID: "review-user", REVIEW_CLERGY_USER_ID: "review-clergy" });
const { entitlement, reviewAccess, PAID_GRACE_MS } = load("src/lib/billing/entitlements.ts");
const { isProUser } = load("src/lib/subscription.ts");
const diagnostics = load("src/lib/diagnostics.ts");
const now = new Date("2026-10-21T12:00:00.000Z");
const hour = 3600000;
const date = hours => new Date(+now + hours * hour);
const unavailable = { unavailable: new Set(["STRIPE"]), complete: false };
function user(overrides = {}) {
  return { id: "alice", email: "alice@example.test", passwordHash: "hash", emailVerified: date(-1),
    plan: "PRO", subscriptionStatus: "active", subscriptionId: "stripe-sub", stripeCustomerId: "stripe-customer",
    lemonSqueezySubscriptionId: null, lemonSqueezyCustomerId: null, billingAccessUntil: null,
    billingGraceUntil: null, billingDeletionRequestedAt: null, legacyReconciliationDeadlineAt: date(72), ...overrides };
}
function row(overrides = {}) {
  return { userId: "alice", provider: "STRIPE", providerSubscriptionId: "stripe-sub", providerCustomerId: "stripe-customer",
    status: "active", lastVerifiedAt: date(-1), paidVerified: true, currentPeriodEndsAt: date(24),
    trialEndsAt: null, cancelAtPeriodEnd: false, legacySnapshotStatus: null, ...overrides };
}
test("legacy candidate receives only its fixed cutover deadline, without persisting a verified deadline", () => {
  const account = user(), before = structuredClone(account);
  const result = entitlement(account, [], unavailable, now);
  assert.equal(result.source, "legacy"); assert.equal(+result.billingAccessUntil, +date(72));
  assert.deepEqual(account, before);
});
for (const hours of [72, 73, 500]) test(`legacy deadline expires at cutover plus ${hours} hours without renewal`, () => {
  assert.equal(entitlement(user(), [], unavailable, date(hours)).plan, "FREE");
});
for (const [label, overrides] of [
  ["missing deadline", { legacyReconciliationDeadlineAt: null }],
  ["FREE snapshot", { plan: "FREE" }], ["cancelled snapshot", { subscriptionStatus: "cancelled" }],
  ["trial snapshot", { subscriptionStatus: "on_trial" }], ["deletion fence", { billingDeletionRequestedAt: now }],
  ["no provider reference", { subscriptionId: null, stripeCustomerId: null }],
  ["previous finite entitlement", { billingAccessUntil: date(-1) }],
]) test(`deadline cannot independently grant access: ${label}`, () => {
  assert.equal(entitlement(user(overrides), [], unavailable, now).plan, "FREE");
});
test("healthy completed reconciliation cannot use a legacy fallback", () => {
  assert.equal(entitlement(user(), [], { complete: true }, now).plan, "FREE");
});
for (const status of ["canceled", "cancelled", "expired", "past_due", "unpaid", "paused", "incomplete_expired"]) {
  test(`unverified terminal evidence ${status} prevents legacy access`, () => {
    assert.equal(entitlement(user(), [row({ status, lastVerifiedAt: null })], unavailable, now).plan, "FREE");
  });
}
test("preserved terminal legacy evidence cannot be hidden by unverified status", () => {
  assert.equal(entitlement(user(), [row({ status: "unverified_legacy", lastVerifiedAt: null, legacySnapshotStatus: "cancelled" })], unavailable, now).plan, "FREE");
});
test("known ownership conflict blocks legacy even when a provider is unavailable", () => {
  assert.equal(entitlement(user(), [], { ...unavailable, conflicted: new Set(["STRIPE"]) }, now).plan, "FREE");
});
for (const collision of [{ userId: "bob" }, { providerCustomerId: "other" }]) test(`local ownership evidence is rejected: ${JSON.stringify(collision)}`, () => {
  assert.equal(entitlement(user(), [row(collision)], unavailable, now).plan, "FREE");
});
test("verified Lemon paid access survives Stripe outage and Stripe ownership conflict", () => {
  const paid = row({ provider: "LEMONSQUEEZY", providerCustomerId: "lemon-customer" });
  const result = entitlement(user(), [paid], { ...unavailable, conflicted: new Set(["STRIPE"]) }, now);
  assert.equal(result.source, "verified"); assert.equal(+result.billingAccessUntil, +paid.currentPeriodEndsAt);
});
for (const status of ["trialing", "on_trial"]) test(`verified ${status} uses trial deadline without inventing a paid period`, () => {
  assert.equal(+entitlement(user(), [row({ status, paidVerified: false, currentPeriodEndsAt: null, trialEndsAt: date(4) })], unavailable, now).billingAccessUntil, +date(4));
});
test("verified scheduled cancellation preserves only its paid-through deadline", () => {
  assert.equal(+entitlement(user(), [row({ cancelAtPeriodEnd: true })], unavailable, now).billingAccessUntil, +date(24));
  assert.equal(entitlement(user(), [row({ cancelAtPeriodEnd: true, currentPeriodEndsAt: date(-1) })], unavailable, now).plan, "FREE");
});
test("verified-paid outage grace is bounded to original period plus 72 hours", () => {
  const paid = row({ currentPeriodEndsAt: date(-1) });
  assert.equal(+entitlement(user(), [paid], unavailable, now).billingAccessUntil, +paid.currentPeriodEndsAt + PAID_GRACE_MS);
  assert.equal(entitlement(user(), [paid], unavailable, date(71)).plan, "FREE");
});
test("unverified data and expired trials cannot obtain paid outage grace", () => {
  for (const paid of [row({ lastVerifiedAt: null }), row({ paidVerified: false, currentPeriodEndsAt: date(-1) }),
    row({ status: "trialing", currentPeriodEndsAt: date(-1), trialEndsAt: date(-1) })]) {
    assert.notEqual(entitlement(user({ legacyReconciliationDeadlineAt: null }), [paid], unavailable, now).source, "paid_grace");
  }
});
test("email alone cannot provide review entitlement", () => {
  assert.equal(reviewAccess(user({ email: "fr-josiah-review@orthodoxai.app" })), false);
});
test("dedicated review binding requires matching ID, email, passwordless verified state and no billing", () => {
  const dedicated = user({ id: "review-user", email: "fr-josiah-review@orthodoxai.app", passwordHash: null,
    subscriptionId: null, stripeCustomerId: null });
  assert.equal(reviewAccess(dedicated), true);
  for (const fields of [{ id: "other" }, { email: "other@example.test" }, { passwordHash: "hash" }, { emailVerified: null },
    { stripeCustomerId: "customer" }, { billingAccessUntil: date(2) }]) assert.equal(reviewAccess({ ...dedicated, ...fields }), false);
});
test("frontend entitlement requires an effective finite deadline or explicit review projection", () => {
  assert.equal(isProUser({ plan: "PRO", subscriptionStatus: "active" }), false);
  assert.equal(isProUser({ plan: "PRO", subscriptionStatus: "active", reviewAccess: true }), true);
  assert.equal(isProUser({ plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(Date.now() + hour) }), true);
});

test("runtime allowlist drops private content, credentials, URLs, nested payloads and arbitrary metadata", () => {
  const output = []; const capture = mock.method(console, "info", value => output.push(value));
  try {
    diagnostics.diagnostic("operation_failed", { operation: "research", failure: "timeout", count: 2,
      query: "PRIVATE_QUERY", journal: "PRIVATE_JOURNAL", token: "SECRET_TOKEN", error: new Error("PRIVATE_ERROR"),
      url: "https://private.example/?token=SECRET", response: { text: "PRIVATE_ANSWER" }, userId: "PRIVATE_ID" });
  } finally { capture.mock.restore(); }
  assert.equal(output.length, 1); assert.doesNotMatch(output[0], /PRIVATE|SECRET|private\.example/);
  const record = JSON.parse(output[0]); assert.equal(record.count, 2); assert.equal(record.failure, "timeout");
  assert.deepEqual(Object.keys(record).sort(), ["at", "correlationId", "count", "event", "failure", "operation"].sort());
});
test("invalid events and runtime field types cannot introduce arbitrary strings", () => {
  const output = []; const capture = mock.method(console, "info", value => output.push(value));
  try {
    diagnostics.diagnostic("PRIVATE_EVENT", { operation: "chat" });
    diagnostics.diagnostic("operation_failed", { operation: "PRIVATE_OPERATION", failure: "SECRET", count: "PRIVATE_COUNT",
      durationMs: Infinity, status: 9999, correlationId: "SECRET_TOKEN" });
  } finally { capture.mock.restore(); }
  assert.equal(output.length, 1); assert.doesNotMatch(output[0], /PRIVATE|SECRET|Infinity/);
});
test("payload getters, toJSON and exception messages are never invoked", () => {
  let invoked = 0; const payload = { toJSON() { invoked++; throw new Error("SECRET"); } };
  Object.defineProperty(payload, "count", { get() { invoked++; throw new Error("SECRET"); }, enumerable: true });
  const exception = Object.defineProperty({}, "message", { get() { invoked++; throw new Error("SECRET"); } });
  const capture = mock.method(console, "info", () => {});
  try { diagnostics.diagnostic("operation_failed", payload); assert.equal(diagnostics.failureCategory(exception), "unexpected"); }
  finally { capture.mock.restore(); }
  assert.equal(invoked, 0);
});
test("logging sink errors do not change operation outcomes", () => {
  const capture = mock.method(console, "info", () => { throw new Error("Sink failed"); });
  try { assert.doesNotThrow(() => diagnostics.diagnostic("operation_failed", { operation: "chat" })); }
  finally { capture.mock.restore(); }
});
test("correlation initialization failures cannot break business operations", () => {
  const capture = mock.method(globalThis.crypto, "randomUUID", () => { throw new Error("Unavailable randomness"); });
  try { assert.doesNotThrow(() => diagnostics.diagnostic("operation_failed", { operation: "chat" })); }
  finally { capture.mock.restore(); }
});
for (const [value, category] of [[{ status: 429 }, "rate_limit"], [{ code: "ETIMEDOUT" }, "timeout"],
  [{ code: "P2002" }, "database"], [{ status: 503 }, "provider"], [{ status: 401 }, "authentication"], [{ status: 403 }, "permission"]]) {
  test(`safe research failure retains ${category} category without private messages`, () => {
    const result = diagnostics.safeResearchFailure({ ...value, message: "PRIVATE_SECRET" });
    assert.equal(result, `RESEARCH_${category.toUpperCase()}`);
    assert.equal(diagnostics.persistedResearchFailure(result), result);
    assert.equal(diagnostics.persistedResearchFailure("PRIVATE_SECRET"), "RESEARCH_UNEXPECTED");
  });
}
test("production diagnostic configuration rejects unsafe dependency debug flags", () => {
  for (const flags of [{ DEBUG: "*" }, { NODE_DEBUG: "http" }]) {
    const diagnosticModule = createLoader({ "server-only": {} }, { NODE_ENV: "production", ...flags })("src/lib/diagnostics.ts");
    assert.throws(() => diagnosticModule.assertSafeDiagnosticEnvironment(), /disabled in production/);
  }
});
test("server source has one allowlisted logging sink and no raw console or stream writes", () => {
  const sinks = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "generated") continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (/\.tsx?$/.test(filename)) {
        const ast = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node) {
          if (ts.isCallExpression(node) && /^(console\.|process\.(stdout|stderr)\.)/.test(node.expression.getText(ast))) sinks.push(filename.replaceAll("\\", "/"));
          ts.forEachChild(node, visit);
        }
        visit(ast);
      }
    }
  }
  walk("src"); assert.deepEqual(sinks, ["src/lib/diagnostics.ts"]);
  assert.match(fs.readFileSync("src/lib/prisma.ts", "utf8"), /log:\s*\[\]/);
  assert.match(fs.readFileSync("src/lib/ai/openaiClient.ts", "utf8"), /logLevel:\s*"off"/);
  assert.doesNotMatch(fs.readFileSync("src/lib/diagnostics.ts", "utf8"), /from\s+["']node:/);
});
test("job completion persistence sanitizes even direct callers and stale attempts remain fenced", async () => {
  const writes = [];
  const prisma = { patristicDiscoveryJob: { updateMany: async args => { writes.push(args); return { count: 0 }; } } };
  const jobs = createLoader({ "server-only": {}, "@/lib/prisma": { prisma } })("src/lib/patristics/job-claims.ts");
  await jobs.finishPatristicJob("job", "attempt", "PRIVATE_QUERY SECRET_TOKEN");
  assert.doesNotMatch(JSON.stringify(writes), /PRIVATE_QUERY|SECRET_TOKEN/);
  assert.equal(writes[0].data.error, "RESEARCH_UNEXPECTED");
  assert.equal(writes[0].where.claimToken, "attempt");
});
for (const endpoint of ["account", "journal", "dashboard", "history"]) test(`${endpoint} exception logs and response exclude private SQL/provider content`, async () => {
  const h = phase6Harness(), output = [];
  const reject = async () => { throw new Error("PRIVATE_JOURNAL PRIVATE_QUERY SECRET_TOKEN https://secret.example"); };
  h.prisma.user.findUnique = reject; h.prisma.journalEntry.findMany = reject; h.prisma.chatMessage.findMany = reject;
  const capture = mock.method(console, "info", value => output.push(value));
  try {
    const response = await h.load(`src/app/api/${endpoint}/route.ts`).GET(new Request(`https://example.test/api/${endpoint}`));
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /PRIVATE_|SECRET_TOKEN|secret\.example/);
  } finally { capture.mock.restore(); }
  assert.equal(output.length, 1); assert.doesNotMatch(output.join(""), /PRIVATE_|SECRET_TOKEN|secret\.example/);
});
test("research failure records only a safe category after exactly one claimed execution", async () => {
  const completed = []; let claims = 0, discovery = 0;
  const worker = createLoader({ "server-only": {},
    "@/lib/prisma": { prisma: { patristicDiscoveryJob: { findUnique: async () => ({ id: "job", query: "PRIVATE_QUERY", language: "en" }) } } },
    "./job-claims": { claimPatristicJob: async () => { claims++; return true; }, finishPatristicJob: async (...args) => completed.push(args) },
    "./discover-and-save": { discoverAndSavePatristicQuotes: async () => { discovery++; throw Object.assign(new Error("PRIVATE_QUERY SECRET_TOKEN"), { status: 429 }); } },
    "./verify-second-source": {}, "./embed-quotes": {},
  })("src/lib/patristics/process-discovery-job.ts");
  await assert.rejects(worker.processPatristicDiscoveryJob("job"), /^Error: RESEARCH_RATE_LIMIT$/);
  assert.equal(claims, 1); assert.equal(discovery, 1); assert.equal(completed.length, 1);
  assert.equal(completed[0][2], "RESEARCH_RATE_LIMIT"); assert.doesNotMatch(JSON.stringify(completed), /PRIVATE|SECRET/);
});
test("source verification retains fetching and exact-match decisions while sanitizing failure metadata", async () => {
  let fetches = 0, matches = 0;
  const verify = createLoader({ "server-only": {},
    "./fetch-source": { fetchSourceText: async () => { fetches++; if (fetches === 2) throw new Error("PRIVATE_URL SECRET_TOKEN"); return { text: "exact source" }; } },
    "./verify": { exactQuoteExists: () => { matches++; return true; } },
    "./trusted-sources": { findTrustedPatristicSource: () => ({ trustLevel: 1, sourceType: "primary" }) },
  })("src/lib/patristics/verify-discovery.ts");
  const capture = mock.method(console, "info", () => {});
  try {
    const results = await verify.verifyDiscoveryCandidates([{ sourceUrl: "https://example.test/one", originalText: "exact source" },
      { sourceUrl: "https://example.test/two", originalText: "exact source" }]);
    assert.equal(fetches, 2); assert.equal(matches, 1); assert.equal(results[0].exactMatch, true);
    assert.equal(results[1].exactMatch, false); assert.equal(results[1].verificationError, "RESEARCH_UNEXPECTED");
  } finally { capture.mock.restore(); }
});
test("prepared migration has one UTC cutover and an immutable deadline, with no executable migration in test", () => {
  const sql = fs.readFileSync("prisma/migrations/20261021000000_bounded_legacy_reconciliation/migration.sql", "utf8");
  assert.equal(sql.charCodeAt(0) === 0xfeff, false);
  assert.match(sql, /SET LOCAL TIME ZONE 'UTC'/); assert.match(sql, /AT TIME ZONE 'UTC'/);
  assert.match(sql, /TIMESTAMP\(3\)/); assert.match(sql, /INTERVAL '72 hours'/);
  assert.equal((sql.match(/clock_timestamp\(\)/g) ?? []).length, 1);
  assert.match(sql, /BEFORE INSERT OR UPDATE/); assert.match(sql, /IS DISTINCT FROM OLD/);
  assert.doesNotMatch(sql, /SET\s+"plan"\s*=/i);
});

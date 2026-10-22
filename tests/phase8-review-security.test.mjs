import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { authHarness } from "./helpers/auth-harness.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Live provider calls forbidden"); });
mock.method(console, "error", () => {});
mock.method(console, "info", () => {});
const identities = {
  "fr-josiah": { id: "dedicated-josiah", email: "josiah@example.test", token: "synthetic-josiah-token" },
  clergy: { id: "dedicated-clergy", email: "clergy@example.test", token: "synthetic-clergy-token" },
};
function harness(env = {}) {
  return authHarness({ env: { REVIEW_USER_ID: identities["fr-josiah"].id, REVIEW_USER_EMAIL: identities["fr-josiah"].email,
    REVIEW_CLERGY_USER_ID: identities.clergy.id, REVIEW_CLERGY_USER_EMAIL: identities.clergy.email,
    REVIEW_ACCESS_TOKEN: identities["fr-josiah"].token, REVIEW_CLERGY_ACCESS_TOKEN: identities.clergy.token, ...env },
    extraMocks: { "@/lib/ai/operationLimits": { withAiOperation: async (_subject, _feature, _user, work) => work() } } });
}
const service = h => h.load("src/lib/security/review-provisioning.ts");
const auth = h => h.load("src/lib/security/auth-service.ts");
function start(h, kind, token = identities[kind].token) {
  return h.load(`src/app/api/review/${kind}/start/route.ts`).GET(new Request(`https://example.test/api/review/${kind}/start?token=${encodeURIComponent(token)}`));
}
function dedicated(h, kind, overrides = {}) {
  return h.addUser({ ...identities[kind], token: undefined, passwordHash: null, emailVerified: new Date(), plan: "PRO", subscriptionStatus: "active", ...overrides });
}
function staleCredentials(h, id) {
  h.state.sessions.push({ id: "old-session", userId: id, token: "a".repeat(64), expiresAt: new Date(Date.now() + 600000) });
  h.state.resets.push({ id: "old-reset", userId: id, tokenHash: auth(h).hashToken("b".repeat(64)), usedAt: null, expiresAt: new Date(Date.now() + 600000) });
  h.state.verifications.push({ id: "old-verify", userId: id, tokenHash: auth(h).hashToken("c".repeat(64)), usedAt: null, expiresAt: new Date(Date.now() + 600000) });
}
for (const kind of Object.keys(identities)) {
  test(`${kind}: attacker email preclaim remains completely unchanged`, async () => {
    const h = harness(); h.addUser({ email: identities[kind].email }); staleCredentials(h, "user");
    const before = structuredClone(h.state);
    assert.equal((await start(h, kind)).status, 409);
    assert.deepEqual(h.state, before); assert.equal(h.jar.size, 0);
  });
  test(`${kind}: verified ordinary account collision remains completely unchanged`, async () => {
    const h = harness(); h.addUser({ email: identities[kind].email, emailVerified: new Date(), plan: "PRO", subscriptionStatus: "active" });
    const before = structuredClone(h.state); assert.equal((await start(h, kind)).status, 409); assert.deepEqual(h.state, before);
    assert.ok(await auth(h).login(identities[kind].email, "password123")); // Collision owner retains ordinary access.
  });
  test(`${kind}: configured ID with another email is rejected unchanged`, async () => {
    const h = harness(); dedicated(h, kind, { email: "another@example.test" }); const before = structuredClone(h.state);
    assert.equal((await start(h, kind)).status, 409); assert.deepEqual(h.state, before);
  });
  test(`${kind}: a password-bearing explicitly bound account is never adopted`, async () => {
    const h = harness(); dedicated(h, kind, { passwordHash: "hash:attacker" }); const before = structuredClone(h.state);
    assert.equal((await start(h, kind)).status, 409); assert.deepEqual(h.state, before);
  });
  test(`${kind}: clean provisioning creates the exact configured passwordless account and session`, async () => {
    const h = harness(); const response = await start(h, kind);
    assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location")).pathname, "/dashboard");
    assert.equal(h.state.users.length, 1); const u = h.state.users[0];
    assert.equal(u.id, identities[kind].id); assert.equal(u.email, identities[kind].email); assert.equal(u.passwordHash, null);
    assert.ok(u.emailVerified); assert.equal(u.plan, "PRO"); assert.equal(h.state.sessions[0].userId, u.id);
    assert.equal((await h.load("src/lib/session.ts").getSessionUser()).id, u.id);
  });
  test(`${kind}: concurrent starts create one identity with sessions scoped to that identity`, async () => {
    const h = harness(); const outcomes = await Promise.all(Array.from({ length: 8 }, () => service(h).startReviewSession(kind)));
    assert.equal(outcomes.length, 8); assert.equal(h.state.users.length, 1); assert.equal(h.state.sessions.length, 8);
    assert.ok(h.state.sessions.every(row => row.userId === identities[kind].id));
  });
  test(`${kind}: concurrent registration cannot obtain a password on a review identity`, async () => {
    const h = harness(); const results = await Promise.all([auth(h).register(identities[kind].email, "Attacker", "password123"), service(h).startReviewSession(kind)]);
    assert.equal(results[0], null); assert.equal(h.state.users.length, 1); assert.equal(h.state.users[0].passwordHash, null);
  });
  test(`${kind}: repeat review access preserves profile, entitlement and history ownership`, async () => {
    const h = harness(); const u = dedicated(h, kind, { name: "Existing reviewer", spiritualGoal: "Preserve this" }); const before = structuredClone(u);
    assert.equal((await start(h, kind)).status, 307); assert.equal((await start(h, kind)).status, 307);
    assert.deepEqual(h.state.users[0], before); assert.equal(h.state.sessions.length, 2);
  });
  test(`${kind}: wrong, missing and opposite-role tokens create no account or session`, async () => {
    const h = harness(); const other = kind === "clergy" ? "fr-josiah" : "clergy";
    for (const token of ["", "wrong", identities[other].token]) assert.equal((await start(h, kind, token)).status, 401);
    assert.equal(h.state.users.length, 0); assert.equal(h.state.sessions.length, 0);
  });
  test(`${kind}: password login, token issuance and changes cannot establish alternate control`, async () => {
    const h = harness(); dedicated(h, kind, { passwordHash: "hash:known" });
    await assert.rejects(auth(h).login(identities[kind].email, "known"), /Invalid email or password/);
    assert.equal(await auth(h).issueEmail(identities[kind].id, "reset"), null);
    assert.equal(await auth(h).issueEmail(identities[kind].id, "verify"), null);
    await assert.rejects(auth(h).changePassword(identities[kind].id, "known", "newpassword"));
    assert.equal(h.state.users[0].passwordHash, "hash:known"); assert.equal(h.state.sessions.length, 0);
  });
  test(`${kind}: outstanding reset and verification links cannot mutate credentials`, async () => {
    const h = harness(); dedicated(h, kind); staleCredentials(h, identities[kind].id); const before = structuredClone(h.state);
    await assert.rejects(auth(h).consumeToken("b".repeat(64), "newpassword"), /Invalid or expired token/);
    await assert.rejects(auth(h).consumeToken("c".repeat(64)), /Invalid or expired token/);
    assert.deepEqual(h.state, before);
  });
  test(`${kind}: explicit operator transition revokes old sessions and both token kinds without changing user data`, async () => {
    const h = harness(); const u = dedicated(h, kind); staleCredentials(h, u.id); const before = structuredClone(u);
    h.jar.set("orthodoxai_session", "a".repeat(64));
    assert.ok(await h.load("src/lib/session.ts").getSessionUser());
    const result = await service(h).transitionLegacyReviewIdentity(kind, { actor: "approved-operator", reference: "synthetic-approval-123", confirmUserId: u.id });
    assert.equal(result.sessionsRevoked, 1); assert.equal(result.resetTokensInvalidated, 1); assert.equal(result.verificationTokensInvalidated, 1);
    assert.equal(await h.load("src/lib/session.ts").getSessionUser(), null);
    assert.deepEqual(h.state.users[0], before);
    assert.equal((await start(h, kind)).status, 307); assert.equal(h.state.sessions.length, 1);
  });
  test(`${kind}: legacy transition without explicit matching authorization fails unchanged`, async () => {
    const h = harness(); const u = dedicated(h, kind); staleCredentials(h, u.id); const before = structuredClone(h.state);
    for (const approval of [{ actor: "", reference: "change", confirmUserId: u.id }, { actor: "operator", reference: "", confirmUserId: u.id }, { actor: "operator", reference: "change", confirmUserId: "wrong" }]) {
      await assert.rejects(service(h).transitionLegacyReviewIdentity(kind, approval));
      assert.deepEqual(h.state, before);
    }
  });
  test(`${kind}: operator transition refuses an ordinary collision even with approval`, async () => {
    const h = harness(); dedicated(h, kind, { passwordHash: "hash:attacker" }); const before = structuredClone(h.state);
    await assert.rejects(service(h).transitionLegacyReviewIdentity(kind, { actor: "operator", reference: "change", confirmUserId: identities[kind].id }));
    assert.deepEqual(h.state, before);
  });
}
for (const [name, env] of [
  ["duplicate IDs", { REVIEW_CLERGY_USER_ID: identities["fr-josiah"].id }],
  ["case-normalized duplicate emails", { REVIEW_CLERGY_USER_EMAIL: " JOSIAH@EXAMPLE.TEST " }],
  ["invalid email", { REVIEW_USER_EMAIL: "invalid" }],
  ["invalid ID", { REVIEW_USER_ID: "bad/id" }],
  ["missing binding", { REVIEW_USER_ID: undefined }],
]) test(`configuration fails closed: ${name}`, async () => {
  const h = harness(env); assert.equal((await start(h, "fr-josiah")).status, 503); assert.equal(h.state.users.length, 0); assert.equal(h.state.sessions.length, 0);
});
for (const [name, overrides] of [
  ["unverified", { emailVerified: null }], ["FREE", { plan: "FREE" }], ["inactive", { subscriptionStatus: "inactive" }],
  ["deletion fence", { billingDeletionRequestedAt: new Date() }], ["Stripe subscriber", { subscriptionId: "existing" }],
  ["Lemon Squeezy customer", { lemonSqueezyCustomerId: "existing" }],
]) test(`ambiguous bound identity rejected unchanged: ${name}`, async () => {
  const h = harness(); dedicated(h, "fr-josiah", overrides); const before = structuredClone(h.state);
  assert.equal((await start(h, "fr-josiah")).status, 409); assert.deepEqual(h.state, before);
});
test("billing records and checkout attempts prohibit review adoption", async () => {
  for (const key of ["billingSubscriptions", "billingCheckouts"]) {
    const h = harness(); dedicated(h, "fr-josiah"); h.state[key].push({ userId: identities["fr-josiah"].id }); const before = structuredClone(h.state);
    assert.equal((await start(h, "fr-josiah")).status, 409); assert.deepEqual(h.state, before);
  }
});
test("reserved registration and reset acknowledgments do not reveal account state", async () => {
  const h = harness(); dedicated(h, "fr-josiah");
  const review = await h.request("auth/register", { email: identities["fr-josiah"].email, password: "password123" });
  const ordinary = await h.request("auth/register", { email: "ordinary@example.test", password: "password123" });
  assert.equal(review.status, 202); assert.deepEqual(await review.json(), await ordinary.json());
  const resets = harness(); dedicated(resets, "fr-josiah"); // Independent admissions; registration legitimately starts an email cooldown.
  const reset = await resets.request("auth/forgot-password", { email: identities["fr-josiah"].email });
  const unknown = await resets.request("auth/forgot-password", { email: "unknown@example.test" });
  assert.equal(reset.status, 202); assert.deepEqual(await reset.json(), await unknown.json()); assert.equal(resets.state.resets.length, 0);
});
test("failed session persistence rolls back new review user creation", async () => {
  const h = harness(); h.prisma.session.create = async () => { throw new Error("Synthetic failure"); };
  await assert.rejects(service(h).startReviewSession("fr-josiah")); assert.equal(h.state.users.length, 0); assert.equal(h.jar.size, 0);
});
test("failed legacy transition rolls back session revocation and token invalidation together", async () => {
  const h = harness(); const u = dedicated(h, "fr-josiah"); staleCredentials(h, u.id); const before = structuredClone(h.state);
  h.prisma.emailVerificationToken.updateMany = async () => { throw new Error("Synthetic transition failure"); };
  await assert.rejects(service(h).transitionLegacyReviewIdentity("fr-josiah", { actor: "operator", reference: "change", confirmUserId: u.id }));
  assert.deepEqual(h.state, before);
});
test("concurrent legacy transition and reset cannot reintroduce a password", async () => {
  const h = harness(); const u = dedicated(h, "fr-josiah"); staleCredentials(h, u.id);
  const results = await Promise.allSettled([
    service(h).transitionLegacyReviewIdentity("fr-josiah", { actor: "operator", reference: "change", confirmUserId: u.id }),
    auth(h).consumeToken("b".repeat(64), "newpassword"),
  ]);
  assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
  assert.equal(h.state.users[0].passwordHash, null); assert.equal(h.state.sessions.length, 0); assert.ok(h.state.resets.every(row => row.usedAt));
});

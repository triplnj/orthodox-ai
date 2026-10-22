import assert from "node:assert/strict";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { mock, test } from "node:test";
import { authHarness } from "./helpers/auth-harness.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("External requests forbidden in authentication tests"); });
mock.method(console, "error", () => {});
const signup = { email: "new@example.test", name: "New User", password: "password123" };
const tokenFrom = mail => new URL(mail.verifyUrl ?? mail.resetUrl).searchParams.get("token");
const signIn = h => h.request("auth/login", { email: "user@example.test", password: "password123" });

test("integration: registration → mocked verification email → verification → first login → database session", async () => {
  const h = authHarness({ realBcrypt: bcrypt });
  const registered = await h.request("auth/register", signup);
  assert.equal(registered.status, 202); assert.equal(h.jar.size, 0); assert.equal(h.state.sessions.length, 0);
  await h.drainEmail(); assert.equal(h.delivered.length, 1); assert.equal(h.delivered[0].to, signup.email);
  assert.equal(h.state.users[0].emailVerified, null);
  assert.equal((await h.request("auth/verify-email", { token: tokenFrom(h.delivered[0]) })).status, 200);
  assert.ok(h.state.users[0].emailVerified);
  const loggedIn = await h.request("auth/login", { email: signup.email, password: signup.password });
  assert.equal(loggedIn.status, 200); assert.equal(h.state.sessions.length, 1);
  assert.match(h.jar.get("orthodoxai_session"), /^[a-f0-9]{64}$/);
  assert.equal((await h.load("src/lib/session.ts").getSessionUser()).email, signup.email);
});
test("integration: failed verification delivery permits unverified login, bounded resend and verification", async () => {
  const h = authHarness(); h.options.emailFailure = true;
  assert.equal((await h.request("auth/register", signup)).status, 202); await h.drainEmail(); assert.equal(h.delivered.length, 0);
  assert.equal((await h.request("auth/login", { email: signup.email, password: signup.password })).status, 200);
  assert.equal((await h.request("auth/resend-verification")).status, 429);
  h.state.buckets = []; // Simulate expiration of the bounded cooldown, not a production override.
  h.options.emailFailure = false;
  assert.equal((await h.request("auth/resend-verification")).status, 202); await h.drainEmail();
  assert.equal((await h.request("auth/verify-email", { token: tokenFrom(h.delivered[0]) })).status, 200);
  assert.equal(h.state.verifications.filter(row => row.usedAt === null).length, 0);
});
test("existing and new registrations return identical status/body and neither signs in", async () => {
  const a = authHarness(), b = authHarness(); b.addUser({ email: signup.email });
  const first = await a.request("auth/register", signup), second = await b.request("auth/register", signup);
  assert.equal(first.status, second.status); assert.deepEqual(await first.json(), await second.json());
  assert.equal(a.jar.size, 0); assert.equal(b.jar.size, 0);
});
test("registration rejects attempted privilege and verification assignment", async () => {
  const h = authHarness(); const response = await h.request("auth/register", { ...signup, plan: "PRO", emailVerified: true, role: "ADMIN" });
  assert.equal(response.status, 400); assert.equal(h.state.users.length, 0); assert.equal(h.state.sessions.length, 0);
});
test("known and unknown reset requests have identical responses", async () => {
  const h = authHarness(); h.addUser();
  const known = await h.request("auth/forgot-password", { email: "user@example.test" });
  const unknown = await h.request("auth/forgot-password", { email: "missing@example.test" });
  assert.equal(known.status, unknown.status); assert.deepEqual(await known.json(), await unknown.json());
});
test("unknown, passwordless and wrong-password logins perform comparison and return identical errors", async () => {
  const compared = [], h = authHarness({ realBcrypt: { hash: async p => p, compare: async (...args) => { compared.push(args); return false; } } });
  h.addUser({ passwordHash: null });
  const a = await signIn(h), b = await h.request("auth/login", { email: "unknown@example.test", password: "wrong" });
  h.state.users[0].passwordHash = "hash:password123";
  const c = await h.request("auth/login", { email: "user@example.test", password: "wrong" });
  const first = await a.json(); assert.equal(compared.length, 3); assert.deepEqual(first, await b.json()); assert.deepEqual(first, await c.json());
});
test("per-account brute force limit applies across different trusted IPs", async () => {
  const h = authHarness(); h.addUser();
  for (let i = 0; i < 10; i++) assert.equal((await h.request("auth/login", { email: "user@example.test", password: "wrong" }, { ip: `8.8.8.${i + 1}` })).status, 401);
  const blocked = await signIn(h); assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});
test("different legitimate users behind one IP retain independent account allowances", async () => {
  const h = authHarness();
  for (let i = 0; i < 20; i++) {
    h.addUser({ id: `user-${i}`, email: `user${i}@example.test` });
    assert.equal((await h.request("auth/login", { email: `user${i}@example.test`, password: "password123" })).status, 200);
  }
});
test("concurrent admissions cannot exceed account rate limit", async () => {
  const h = authHarness(); const limit = h.load("src/lib/security/auth-limits.ts");
  const req = new Request("https://example.test", { headers: { "x-test-ingress-ip": "8.8.8.8" } });
  const result = await Promise.allSettled(Array.from({ length: 15 }, () => limit.authLimit(req, "login", "same-account")));
  assert.equal(result.filter(r => r.status === "fulfilled").length, 10);
});
test("rate-limit keys contain no raw email or IP and configuration fails closed", async () => {
  const h = authHarness(); await signIn(h);
  assert.ok(h.state.buckets.every(row => /^[a-f0-9]{64}$/.test(row.key)));
  h.load.environment.AUTH_RATE_LIMIT_SECRET = undefined; assert.equal((await signIn(h)).status, 503);
});
test("client-supplied forwarding chains are not accepted as trusted IPs", () => {
  const h = authHarness(), { clientAddress } = h.load("src/lib/security/auth-limits.ts");
  assert.equal(clientAddress(new Request("https://example.test", { headers: { "x-forwarded-for": "8.8.8.8" } })), "unknown-ingress");
  assert.equal(clientAddress(new Request("https://example.test", { headers: { "x-test-ingress-ip": "8.8.8.8, 1.1.1.1" } })), "unknown-ingress");
});
test("email cooldown is shared between registration and password reset", async () => {
  const h = authHarness(); await h.request("auth/register", signup);
  assert.equal((await h.request("auth/forgot-password", { email: signup.email })).status, 429);
});
test("email failure does not invalidate a previously delivered verification link", async () => {
  const h = authHarness(); h.addUser(); await signIn(h); await h.request("auth/resend-verification"); await h.drainEmail();
  const old = tokenFrom(h.delivered[0]); h.state.buckets = []; h.options.emailFailure = true;
  await h.request("auth/resend-verification"); await h.drainEmail();
  assert.equal((await h.request("auth/verify-email", { token: old })).status, 200);
});
test("email failure does not invalidate a previously delivered password-reset link", async () => {
  const h = authHarness(); h.addUser(); await h.request("auth/forgot-password", { email: "user@example.test" }); await h.drainEmail();
  const old = tokenFrom(h.delivered[0]); h.state.buckets = []; h.options.emailFailure = true;
  await h.request("auth/forgot-password", { email: "user@example.test" }); await h.drainEmail();
  assert.equal((await h.request("auth/reset-password", { token: old, password: "changed123", confirmPassword: "changed123" })).status, 200);
});
for (const sameToken of [true, false]) test(`concurrent reset using ${sameToken ? "same" : "different"} tokens changes the password exactly once`, async () => {
  const h = authHarness(); const u = h.addUser(), service = h.load("src/lib/security/auth-service.ts");
  const a = await service.issueEmail(u.id, "reset"), b = sameToken ? a : await service.issueEmail(u.id, "reset");
  const result = await Promise.allSettled([service.consumeToken(a.rawToken, "first1234"), service.consumeToken(b.rawToken, "second123")]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1); assert.equal(h.state.resets.filter(row => row.usedAt === null).length, 0);
});
test("password reset revokes every session and rejects token replay", async () => {
  const h = authHarness(); h.addUser(); await signIn(h); await signIn(h);
  await h.request("auth/forgot-password", { email: "user@example.test" }); await h.drainEmail();
  const body = { token: tokenFrom(h.delivered[0]), password: "changed123", confirmPassword: "changed123" };
  const response = await h.request("auth/reset-password", body); assert.equal(response.status, 200); assert.equal(h.state.sessions.length, 0);
  assert.match(response.headers.get("set-cookie"), /orthodoxai_session=;/);
  assert.equal((await h.request("auth/reset-password", body)).status, 400);
});
test("password change revokes every session and outstanding reset token", async () => {
  const h = authHarness(); const u = h.addUser(); await signIn(h); await signIn(h);
  await h.load("src/lib/security/auth-service.ts").issueEmail(u.id, "reset");
  const response = await h.request("settings/password", { currentPassword: "password123", newPassword: "changed123", confirmPassword: "changed123" }, { method: "PATCH" });
  assert.equal(response.status, 200); assert.equal(h.state.sessions.length, 0); assert.ok(h.state.resets.every(row => row.usedAt));
  assert.equal((await response.json()).signInRequired, true);
});
test("failed password update rolls back token consumption and session revocation", async () => {
  const h = authHarness(); const u = h.addUser(); await signIn(h); const service = h.load("src/lib/security/auth-service.ts");
  const mail = await service.issueEmail(u.id, "reset"); h.options.updateFailure = true;
  await assert.rejects(service.consumeToken(mail.rawToken, "changed123")); assert.equal(h.state.resets[0].usedAt, null); assert.equal(h.state.sessions.length, 1);
  h.options.updateFailure = false; await service.consumeToken(mail.rawToken, "changed123"); assert.equal(h.state.sessions.length, 0);
});
test("login racing with password reset cannot retain an old-password session", async () => {
  const h = authHarness(); const u = h.addUser(), service = h.load("src/lib/security/auth-service.ts"), mail = await service.issueEmail(u.id, "reset");
  await Promise.allSettled([service.login(u.email, "password123"), service.consumeToken(mail.rawToken, "changed123")]);
  assert.equal(h.state.sessions.length, 0); await assert.rejects(service.login(u.email, "password123"));
  await service.login(u.email, "changed123"); assert.equal(h.state.sessions.length, 1);
});
test("expired tokens cannot be consumed", async () => {
  const h = authHarness(); const u = h.addUser(), service = h.load("src/lib/security/auth-service.ts"), mail = await service.issueEmail(u.id, "reset");
  h.state.resets[0].expiresAt = new Date(0); await assert.rejects(service.consumeToken(mail.rawToken, "changed123")); assert.equal(h.state.users[0].passwordHash, "hash:password123");
});
test("verification token is atomically single-use and invalidates sibling verification tokens", async () => {
  const h = authHarness(); const u = h.addUser(), service = h.load("src/lib/security/auth-service.ts"), mail = await service.issueEmail(u.id, "verify");
  await service.issueEmail(u.id, "verify"); const result = await Promise.allSettled([service.consumeToken(mail.rawToken), service.consumeToken(mail.rawToken)]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1); assert.ok(h.state.verifications.every(row => row.usedAt));
});
for (const cookie of ["bad-cookie", "a".repeat(64)]) test(`invalid session cookie is cleared without redirect loop: ${cookie.slice(0, 10)}`, async () => {
  const h = authHarness(); h.jar.set("orthodoxai_session", cookie);
  const response = await h.request("auth/clear-invalid-session", undefined, { method: "GET" });
  assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location")).pathname, "/login"); assert.match(response.headers.get("set-cookie"), /orthodoxai_session=;/);
});
test("expired sessions are removed idempotently, valid sessions preserve normal logout", async () => {
  const h = authHarness(); h.addUser(); await signIn(h); const session = h.load("src/lib/session.ts");
  h.state.sessions[0].expiresAt = new Date(0); assert.equal(await session.getSessionUser(), null); assert.equal(await session.getSessionUser(), null);
  await signIn(h); assert.ok(await session.getSessionUser()); await session.destroySession(); assert.equal(h.jar.size, 0); assert.equal(h.state.sessions.length, 0);
});
test("middleware never treats cookie presence as authenticated", () => {
  const h = authHarness(), { middleware } = h.load("middleware.ts");
  assert.equal(middleware({ nextUrl: { pathname: "/login" }, cookies: { get: () => ({ value: "invalid" }) }, url: "https://example.test/login" }).status, 200);
  assert.equal(middleware({ nextUrl: { pathname: "/dashboard" }, cookies: { get: () => undefined }, url: "https://example.test/dashboard" }).status, 307);
});
for (const destination of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/%2f%2fevil.test", "/%255cevil.test", "/%0aevil", "/login", "/api/auth/logout", "/x/../login", "/%zz"]) {
  test(`unsafe login redirect rejected: ${destination}`, () => { assert.equal(authHarness().load("src/lib/security/redirect.ts").safeLoginPath(destination), "/dashboard"); });
}
test("safe application paths preserve query and fragment", () => {
  const { safeLoginPath } = authHarness().load("src/lib/security/redirect.ts"); assert.equal(safeLoginPath("/journal?entry=1#today"), "/journal?entry=1#today");
});
for (const body of [null, [], { email: {}, password: "password123" }, { email: "bad", password: "password123" }, { email: "x@example.test", password: "a".repeat(73) }, { email: "x@example.test", password: "é".repeat(37) }]) {
  test(`registration rejects malformed or bcrypt-truncated input: ${JSON.stringify(body)}`, async () => { assert.equal((await authHarness().request("auth/register", body)).status, 400); });
}
test("oversized bodies fail before password hashing or email delivery", async () => {
  const h = authHarness(); assert.equal((await h.request("auth/register", { ...signup, name: "x".repeat(17000) })).status, 413); assert.equal(h.state.users.length, 0);
});
test("UI uses validated redirects and exposes verification/sign-in recovery", () => {
  assert.match(fs.readFileSync("src/components/auth/LoginForm.tsx", "utf8"), /safeLoginPath\(params.get\("next"\)\)/);
  assert.match(fs.readFileSync("src/components/auth/RegisterForm.tsx", "utf8"), /role="status"/);
  assert.match(fs.readFileSync("src/app/verify-email/page.tsx", "utf8"), /href="\/login\?next=\/onboarding"/);
});
function nodes(tree, predicate, found = []) {
  if (!tree || typeof tree !== "object") return found;
  if (predicate(tree)) found.push(tree);
  for (const child of [].concat(tree.props?.children ?? [])) nodes(child, predicate, found);
  return found;
}
test("integration: real registration and login form handlers complete the mocked-email onboarding flow", async t => {
  let state = [], cursor = 0;
  const navigation = [];
  const h = authHarness({ extraMocks: {
    react: { useRef: initial => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; }, useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } },
    "next/navigation": { useRouter: () => ({ push: path => navigation.push(path), refresh: () => {} }) },
  } });
  t.mock.method(globalThis, "fetch", async (path, init) => h.request(path.replace(/^\/api\//, ""), JSON.parse(init.body)));
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "?next=%2Fonboarding" } };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const Register = h.load("src/components/auth/RegisterForm.tsx").default;
  const render = Component => { cursor = 0; return Component(); };
  let tree = render(Register);
  for (const [id, value] of [["register-name", signup.name], ["register-email", signup.email], ["register-password", signup.password]]) {
    nodes(tree, node => node.props?.id === id)[0].props.onChange({ target: { value } }); tree = render(Register);
  }
  await nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} }); tree = render(Register);
  assert.equal(nodes(tree, node => node.props?.role === "status").length, 1); assert.deepEqual(navigation, []);
  await h.drainEmail(); const token = tokenFrom(h.delivered[0]); assert.equal((await h.request("auth/verify-email", { token })).status, 200);
  state = []; const Login = h.load("src/components/auth/LoginForm.tsx").default; tree = render(Login);
  for (const [id, value] of [["login-email", signup.email], ["login-password", signup.password]]) {
    nodes(tree, node => node.props?.id === id)[0].props.onChange({ target: { value } }); tree = render(Login);
  }
  await nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(navigation, ["/onboarding"]); assert.ok(await h.load("src/lib/session.ts").getSessionUser());
});
test("bounded cooldown expires naturally after delivery failure", async t => {
  const h = authHarness(); h.addUser(); h.options.emailFailure = true;
  const start = Date.now(); let clock = start;
  t.mock.method(Date, "now", () => clock);
  assert.equal((await h.request("auth/forgot-password", { email: "user@example.test" })).status, 202); await h.drainEmail();
  assert.equal((await h.request("auth/forgot-password", { email: "user@example.test" })).status, 429);
  clock += 61000; h.options.emailFailure = false;
  assert.equal((await h.request("auth/forgot-password", { email: "user@example.test" })).status, 202); await h.drainEmail(); assert.equal(h.delivered.length, 1);
});
test("hourly recipient send limit remains enforced across cooldown windows", async t => {
  const h = authHarness(); h.addUser(); let clock = Date.now(); t.mock.method(Date, "now", () => clock);
  // Start at a stable hour boundary so no window reset occurs during the test.
  clock = Math.floor(clock / 3600000) * 3600000 + 1000;
  for (let i = 0; i < 5; i++) { assert.equal((await h.request("auth/forgot-password", { email: "user@example.test" })).status, 202); clock += 61000; }
  assert.equal((await h.request("auth/forgot-password", { email: "user@example.test" })).status, 429);
});
test("authenticated pages redirect valid sessions, but route invalid cookies to cleanup", async () => {
  const h = authHarness(); h.addUser(); await signIn(h);
  const page = h.load("src/lib/security/auth-page.ts"); await assert.rejects(page.guardAuthenticationPage(), { location: "/dashboard" });
  h.jar.set("orthodoxai_session", "revoked"); await assert.rejects(page.guardAuthenticationPage(), { location: "/api/auth/clear-invalid-session" });
  h.jar.clear(); await page.guardAuthenticationPage();
});
test("verification and reset submission reject malformed token objects", async () => {
  for (const path of ["auth/verify-email", "auth/reset-password"]) {
    const h = authHarness(); assert.equal((await h.request(path, { token: { value: "token" }, password: "password123", confirmPassword: "password123" })).status, 400);
  }
});

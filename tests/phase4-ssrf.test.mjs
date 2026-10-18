import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import { mock, test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";
import { authHarness } from "./helpers/auth-harness.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("External network forbidden in SSRF tests"); });
const dns = createLoader({ "server-only": {} })("src/lib/security/public-dns.ts");
function transportHarness() {
  const requests = [], lookups = [], replies = [];
  const options = { addresses: ["8.8.8.8"], remote: "8.8.8.8", hang: false, dnsFailure: false };
  const https = { request: (url, init, callback) => {
    requests.push({ url: url.toString(), init });
    const req = new EventEmitter(); let destroyed = false;
    req.destroy = error => { if (!destroyed) { destroyed = true; if (error) req.emit("error", error); req.emit("close"); } return req; };
    const abort = () => req.destroy(new Error("Mock request aborted")); init.signal.addEventListener("abort", abort, { once: true });
    req.on("close", () => init.signal.removeEventListener("abort", abort));
    req.end = () => {
      if (options.hang) return;
      queueMicrotask(() => {
        if (destroyed) return;
        init.lookup(url.hostname, {}, (_error, address, family) => { lookups.push({ address, family }); });
        const socket = new EventEmitter(); socket.remoteAddress = options.remote;
        req.emit("socket", socket); socket.emit("secureConnect"); if (destroyed) return;
        const reply = replies.shift() ?? { status: 200, body: "<p>Patristic source</p>" };
        const response = Readable.from(reply.chunks ?? [Buffer.from(reply.body ?? "")]);
        response.statusCode = reply.status; response.headers = reply.headers ?? {};
        req.emit("response", response); callback(response);
        response.on("close", () => req.emit("close"));
      });
    };
    return req;
  } };
  const h = authHarness({ extraMocks: { "node:https": https, "./public-dns": { ...dns, resolvePublicAddresses: async () => {
    if (options.dnsFailure || options.addresses.some(address => !dns.publicAddress(address))) throw new Error("Unsafe DNS");
    return options.addresses;
  } } } });
  return { ...h, requests, replies, lookups, options, transport: h.load("src/lib/security/source-transport.ts"), policy: h.load("src/lib/security/source-policy.ts") };
}
for (const address of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1"]) {
  test(`non-global or transition address rejected: ${address}`, () => assert.equal(dns.publicAddress(address), false));
}
for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
  test(`global address admitted: ${address}`, () => assert.equal(dns.publicAddress(address), true));
}
for (const url of ["http://newadvent.org/fathers", "https://127.0.0.1", "https://2130706433", "https://[::1]", "https://user:pass@newadvent.org", "https://newadvent.org:8443", "https://newadvent.org./fathers", "https://newadvent.org\\@evil.test", "https://evil.test", "https://newadvent.org.evil.test"]) {
  test(`unsafe or unapproved URL denied before connecting: ${url}`, async () => { const h = transportHarness(); await assert.rejects(h.transport.safeSourceFetch(url)); assert.equal(h.requests.length, 0); });
}
test("source request pins DNS while retaining TLS hostname and strips credentials", async () => {
  const h = transportHarness(); const response = await h.transport.safeSourceFetch("https://newadvent.org/fathers", { headers: { Authorization: "must-not-forward", Cookie: "must-not-forward" } });
  assert.equal(response.status, 200); assert.equal(await response.text(), "<p>Patristic source</p>");
  assert.deepEqual(h.lookups, [{ address: "8.8.8.8", family: 4 }]); assert.equal(h.requests[0].init.servername, "newadvent.org");
  assert.equal(h.requests[0].init.rejectUnauthorized, true);
  assert.equal(h.requests[0].init.headers.Authorization, undefined); assert.equal(h.requests[0].init.headers.Cookie, undefined); assert.equal(h.requests[0].init.agent, false);
});
test("mixed private/public DNS answers fail closed", async () => {
  const h = transportHarness(); h.options.addresses = ["8.8.8.8", "127.0.0.1"]; await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/")); assert.equal(h.requests.length, 0);
});
test("unexpected connected peer is rejected despite a previously safe DNS answer", async () => {
  const h = transportHarness(); h.options.remote = "10.0.0.1"; await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/"), /peer/);
});
test("relative and www redirects retain source compatibility", async () => {
  const h = transportHarness(); h.replies.push({ status: 302, headers: { location: "/fathers" } }, { status: 301, headers: { location: "https://www.newadvent.org/fathers" } });
  assert.equal((await h.transport.safeSourceFetch("https://newadvent.org/")).status, 200); assert.equal(h.requests.length, 3);
});
for (const location of ["http://newadvent.org/", "https://127.0.0.1/", "https://evil.test/", "https://azbyka.ru/", "https://newadvent.org:8443/"]) {
  test(`unsafe redirect rejected: ${location}`, async () => { const h = transportHarness(); h.replies.push({ status: 302, headers: { location } });
    await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/")); assert.equal(h.requests.length, 1); });
}
test("Archive download redirects allow reviewed shards and validate each destination", async () => {
  const h = transportHarness(); h.replies.push({ status: 302, headers: { location: "https://ia800100.us.archive.org/download/book/book_djvu.xml" } });
  assert.equal((await h.transport.safeSourceFetch("https://archive.org/download/book/book_djvu.xml")).status, 200);
  assert.equal(h.requests.length, 2); assert.equal(await h.policy.allowedSource("ia800100.us.archive.org"), false);
});
test("unrecognized archive subdomain patterns are denied", async () => { const h = transportHarness(); assert.equal(await h.policy.allowedSource("evil.archive.org", "archive.org"), false); });
test("redirect loops stop at five hops", async () => {
  const h = transportHarness(); for (let i = 0; i < 6; i++) h.replies.push({ status: 302, headers: { location: "/loop" } });
  await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/"), /limit/); assert.equal(h.requests.length, 6);
});
test("content-length limit rejects the response before buffering", async () => {
  const h = transportHarness(); h.replies.push({ status: 200, headers: { "content-length": "9999999999" } }); await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/"), /size/);
});
test("streamed response cannot bypass the size cap without content-length", async () => {
  const h = transportHarness(); h.replies.push({ status: 200, chunks: [Buffer.alloc(800), Buffer.alloc(800)] });
  await assert.rejects(h.transport.pinnedSourceRequest(new URL("https://newadvent.org/"), {}, AbortSignal.timeout(1000), 1024), /size/);
});
test("compressed response cannot bypass decoded-size limits", async () => {
  const h = transportHarness(); h.replies.push({ status: 200, body: gzipSync(Buffer.alloc(5000)), headers: { "content-encoding": "gzip" } });
  await assert.rejects(h.transport.pinnedSourceRequest(new URL("https://newadvent.org/"), {}, AbortSignal.timeout(1000), 1024), /size/);
});
test("connection hangs obey caller deadline and release request resources", async () => {
  const h = transportHarness(); h.options.hang = true;
  await assert.rejects(h.transport.safeSourceFetch("https://newadvent.org/", { signal: AbortSignal.timeout(20) }), /aborted/);
});
test("default source hosts include all current curated and authoritative destinations", async () => {
  const h = transportHarness();
  for (const host of ["en.wikisource.org", "el.wikisource.org", "la.wikisource.org", "archive.org", "onlinebooks.library.upenn.edu", "remacle.org", "syri.ac", "www.gorgiaspress.com", "www.vlioras.gr", "www.gutenberg.org", "www.newadvent.org", "patrologiagraeca.org", "philokalia.com", "biblegateway.com"]) assert.equal(await h.policy.allowedSource(host), true, host);
});
async function adminSignIn(h, overrides = {}) {
  h.addUser({ id: "admin", email: "admin@example.test", emailVerified: new Date(), ...overrides });
  await h.request("auth/login", { email: "admin@example.test", password: "password123" });
}
const newDomain = { hostname: "texts.example.org", enabled: true, redirectHosts: [], reason: "Reviewed primary patristic text publisher and HTTPS source provenance." };
test("ordinary and unverified accounts cannot authorize source domains or trigger probes", async () => {
  for (const overrides of [{ id: "ordinary" }, { emailVerified: null }]) {
    const h = transportHarness(); await adminSignIn(h, overrides);
    assert.equal((await h.request("admin/patristic-source-domains", newDomain)).status, 403); assert.equal(h.requests.length, 0); assert.equal(h.state.domains.length, 0);
  }
});
test("anonymous callers cannot authorize domains", async () => { const h = transportHarness(); assert.equal((await h.request("admin/patristic-source-domains", newDomain)).status, 401); });
test("administrator adds a DNS/HTTPS-verified exact hostname without code changes and writes audit", async () => {
  const h = transportHarness(); await adminSignIn(h); const result = await h.request("admin/patristic-source-domains", newDomain);
  assert.equal(result.status, 200); assert.equal(await h.policy.allowedSource(newDomain.hostname), true);
  assert.equal(h.state.audits[0].actorId, "admin"); assert.equal(h.state.audits[0].action, "ENABLE"); assert.deepEqual(h.state.audits[0].addresses, ["8.8.8.8"]);
  assert.equal((await h.transport.safeSourceFetch(`https://${newDomain.hostname}/book`)).status, 200);
});
test("administrator can disable a source immediately and audit the action", async () => {
  const h = transportHarness(); await adminSignIn(h); await h.request("admin/patristic-source-domains", { ...newDomain, enabled: false });
  await assert.rejects(h.transport.safeSourceFetch(`https://${newDomain.hostname}/book`)); assert.equal(h.state.audits[0].action, "DISABLE");
});
test("private DNS source approval fails and is audited without granting access", async () => {
  const h = transportHarness(); await adminSignIn(h); h.options.addresses = ["169.254.169.254"];
  assert.equal((await h.request("admin/patristic-source-domains", newDomain)).status, 400); assert.equal(h.state.domains.length, 0); assert.equal(h.state.audits[0].action, "VERIFICATION_FAILED");
});
test("domain management accepts no URL, wildcard, port or IP-literal escape hatch", async () => {
  for (const hostname of ["https://texts.example.org/", "*.example.org", "texts.example.org:443", "127.0.0.1", "user@texts.example.org"]) {
    const h = transportHarness(); await adminSignIn(h); const response = await h.request("admin/patristic-source-domains", { ...newDomain, hostname });
    assert.notEqual(response.status, 200); assert.equal(h.state.domains.length, 0); assert.equal(h.requests.length, 0);
  }
});
test("new domains cannot introduce an unapproved redirect target", async () => {
  const h = transportHarness(); await adminSignIn(h);
  assert.equal((await h.request("admin/patristic-source-domains", { ...newDomain, redirectHosts: ["evil.example.org"] })).status, 400);
  assert.equal(h.state.domains.length, 0);
});
test("administrator-approved redirect edges work only while both domains remain enabled", async () => {
  const h = transportHarness(); await adminSignIn(h);
  assert.equal((await h.request("admin/patristic-source-domains", { ...newDomain, redirectHosts: ["remacle.org"] })).status, 200);
  h.replies.push({ status: 302, headers: { location: "https://remacle.org/text" } });
  assert.equal((await h.transport.safeSourceFetch(`https://${newDomain.hostname}/text`)).status, 200);
  h.state.domains.push({ hostname: "remacle.org", enabled: false });
  assert.equal(await h.policy.allowedSource("remacle.org", newDomain.hostname), false);
});
test("audit failure rolls back source authorization", async () => {
  const h = transportHarness(); await adminSignIn(h); h.prisma.patristicSourceDomainAudit.create = async () => { throw new Error("Audit unavailable"); };
  assert.equal((await h.request("admin/patristic-source-domains", newDomain)).status, 503); assert.equal(h.state.domains.length, 0);
});
test("all patristic network fetch helpers use the bounded transport", () => {
  for (const name of fs.readdirSync("src/lib/patristics").filter(name => name.endsWith(".ts"))) {
    const source = fs.readFileSync(`src/lib/patristics/${name}`, "utf8"); assert.doesNotMatch(source, /await fetch\(/, name);
  }
});
test("real DNS validator rejects a mixed answer and cancels its resolver", async () => {
  let cancelled = 0;
  class Resolver { async resolve4() { return ["8.8.8.8", "10.0.0.1"]; } async resolve6() { return []; } cancel() { cancelled++; } }
  const load = createLoader({ "server-only": {}, "node:dns/promises": { Resolver } });
  await assert.rejects(load("src/lib/security/public-dns.ts").resolvePublicAddresses("newadvent.org", AbortSignal.timeout(1000)), /unsafe/); assert.equal(cancelled, 1);
});
test("real DNS validator handles DNS failure without leaving pending resolution", async () => {
  class Resolver { async resolve4() { throw new Error("ENOTFOUND"); } async resolve6() { throw new Error("ENOTFOUND"); } cancel() {} }
  const load = createLoader({ "server-only": {}, "node:dns/promises": { Resolver } });
  await assert.rejects(load("src/lib/security/public-dns.ts").resolvePublicAddresses("newadvent.org", AbortSignal.timeout(1000)), /unresolved/);
});
test("source approval cannot be enabled when HTTPS redirects to an unsafe host", async () => {
  const h = transportHarness(); await adminSignIn(h); h.replies.push({ status: 302, headers: { location: "http://127.0.0.1/" } });
  assert.equal((await h.request("admin/patristic-source-domains", newDomain)).status, 400); assert.equal(h.state.domains.length, 0); assert.equal(h.state.audits[0].action, "VERIFICATION_FAILED");
});

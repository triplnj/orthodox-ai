import assert from "node:assert/strict";
import { test, mock } from "node:test";
import fs from "node:fs";
import { createLoader } from "./helpers/load-ts.mjs";

mock.method(globalThis, "fetch", () => { throw new Error("Live network forbidden"); });
const tick = () => new Promise(resolve => setImmediate(resolve));
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
function harness(t, handler = async () => Response.json({ conversations: [] }), mocks = {}) {
  const slots = []; let cursor = 0; const effects = [];
  t.mock.method(globalThis, "fetch", handler);
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.window = { location: { href: "https://example.test/chat", search: "" }, history: { replaceState() {} } };
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(() => { globalThis.window = originalWindow; globalThis.sessionStorage = originalStorage; });
  const load = createLoader({
    "next/link": { __esModule: true, default: "a" },
    "next/navigation": { usePathname: () => "/chat", useRouter: () => ({ push() {}, refresh() {}, replace() {} }), useSearchParams: () => new URLSearchParams("token=example") },
    react: {
      Suspense: "suspense",
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useEffect(effect, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((dep, n) => dep !== previous.deps[n])) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); }); } },
    }, ...mocks,
  });
  return { load, render(Component, props = {}) { cursor = 0; return Component(props); }, flushEffects() { effects.splice(0).forEach(effect => effect()); }, cleanup() { slots.forEach(slot => slot?.cleanup?.()); }, storage };
}
const button = (tree, name) => nodes(tree, node => node.type === "button" && text(node) === name)[0];
const question = tree => nodes(tree, node => node.type === "textarea")[0];
const saved = tree => nodes(tree, node => node.type === "select")[0];

test("mobile navigation has a controlled disclosure, matching desktop destinations and current page", t => {
  const h = harness(t); const Nav = h.load("src/components/layout/NavbarClient.tsx").NavbarClient;
  let tree = h.render(Nav, { user: null, isPro: false });
  const toggle = nodes(tree, node => node.props?.["aria-controls"])[0];
  assert.equal(toggle.props["aria-expanded"], false); toggle.props.onClick();
  tree = h.render(Nav, { user: null, isPro: false });
  assert.equal(nodes(tree, node => node.props?.["aria-controls"])[0].props["aria-expanded"], true);
  const navs = nodes(tree, node => node.type === "nav");
  const hrefs = nav => nodes(nav, node => node.props?.href).map(node => node.props.href);
  assert.deepEqual(hrefs(navs[0]), hrefs(navs[2])); assert.deepEqual(hrefs(navs[1]), hrefs(navs[3]));
  assert.equal(nodes(navs[0], node => node.props?.["aria-current"] === "page")[0].props.href, "/chat");
  assert.match(navs[2].props.className, /grid-cols-2/);
});

test("Escape closes the mobile menu and returns focus to its toggle", t => {
  const h = harness(t); const Nav = h.load("src/components/layout/NavbarClient.tsx").NavbarClient;
  let tree = h.render(Nav, { user: null, isPro: false }); let focused = false;
  const toggle = nodes(tree, node => node.props?.["aria-controls"])[0]; toggle.props.ref.current = { focus() { focused = true; } }; toggle.props.onClick();
  tree = h.render(Nav, { user: null, isPro: false }); tree.props.onKeyDown({ key: "Escape" });
  assert.equal(focused, true); assert.equal(nodes(h.render(Nav, { user: null, isPro: false }), node => node.props?.["aria-controls"])[0].props["aria-expanded"], false);
});

test("following a mobile destination closes the disclosure", t => {
  const h = harness(t); const Nav = h.load("src/components/layout/NavbarClient.tsx").NavbarClient;
  let tree = h.render(Nav, { user: null, isPro: false }); nodes(tree, node => node.props?.["aria-controls"])[0].props.onClick();
  tree = h.render(Nav, { user: null, isPro: false }); nodes(tree, node => node.props?.href === "/journal")[1].props.onClick();
  assert.equal(nodes(h.render(Nav, { user: null, isPro: false }), node => node.props?.["aria-controls"])[0].props["aria-expanded"], false);
});

for (const [file, exportName] of [
  ["src/components/auth/LoginForm.tsx", "default"], ["src/components/auth/RegisterForm.tsx", "default"],
  ["src/app/forgot-password/page.tsx", "default"], ["src/app/onboarding/page.tsx", "default"],
  ["src/components/pro/PrayerPlanForm.tsx", "PrayerPlanForm"], ["src/components/pro/FastingPlanForm.tsx", "FastingPlanForm"],
  ["src/components/pro/ScripturePlanForm.tsx", "ScripturePlanForm"], ["src/app/journal/page.tsx", "default"],
]) test(`${file}: inputs have visible associated labels`, t => {
  const h = harness(t); const tree = h.render(h.load(file)[exportName]);
  const labels = nodes(tree, node => node.type === "label");
  for (const input of nodes(tree, node => ["input", "select", "textarea"].includes(node.type))) {
    assert.ok(input.props.id && labels.some(label => label.props.htmlFor === input.props.id) || labels.some(label => nodes(label, node => node === input).length), `${file}: unnamed ${input.type}`);
  }
});

test("login network errors preserve typed credentials and announce the error", async t => {
  const h = harness(t, async () => { throw new Error("offline"); }); const Form = h.load("src/components/auth/LoginForm.tsx").default;
  let tree = h.render(Form); let inputs = nodes(tree, node => node.type === "input"); inputs[0].props.onChange({ target: { value: "person@example.test" } }); inputs[1].props.onChange({ target: { value: "private-password" } });
  tree = h.render(Form); await nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} }); tree = h.render(Form);
  inputs = nodes(tree, node => node.type === "input"); assert.equal(inputs[0].props.value, "person@example.test"); assert.equal(inputs[1].props.value, "private-password");
  assert.equal(nodes(tree, node => node.props?.role === "alert").length, 1);
});

test("rapid authentication submissions send one request", async t => {
  let resolve; let calls = 0; const gate = new Promise(done => { resolve = done; });
  const h = harness(t, async () => { calls++; await gate; return Response.json({ error: "Rejected" }, { status: 400 }); });
  const Form = h.load("src/components/auth/LoginForm.tsx").default; const tree = h.render(Form); const submit = nodes(tree, node => node.type === "form")[0].props.onSubmit;
  const first = submit({ preventDefault() {} }); await submit({ preventDefault() {} }); assert.equal(calls, 1); resolve(); await first;
});

test("source cards expose a semantic list, exact safe links, and new-tab notice", t => {
  const h = harness(t); const Cards = h.load("src/components/chat/SourceCards.tsx").SourceCards;
  const source = { authorName: "Author", workTitle: "Work", reference: "Book 1, 2", provider: "WEB_RESEARCH", verificationStatus: "LIVE_WEB_RESEARCH", sourceUrl: "https://example.test/work#passage" };
  const tree = Cards({ sources: [source] }); assert.equal(nodes(tree, node => node.type === "li").length, 1);
  const link = nodes(tree, node => node.type === "a")[0]; assert.equal(link.props.href, source.sourceUrl); assert.match(text(link), /opens in a new tab/); assert.match(link.props.rel, /noopener/);
  assert.match(text(tree), /Book 1, 2/); assert.match(text(tree), /do not assert/);
});

test("unsafe source URLs never become clickable links", t => {
  const h = harness(t); const Cards = h.load("src/components/chat/SourceCards.tsx").SourceCards;
  assert.equal(nodes(Cards({ sources: [{ sourceUrl: "javascript:alert(1)", provider: "WEB_RESEARCH", verificationStatus: "unknown" }] }), node => node.type === "a").length, 0);
});

test("conversation switching restores per-conversation drafts and never sends AI POST", async t => {
  const calls = []; const h = harness(t, async (url, init) => { calls.push([url, init?.method]); return Response.json({ contextKey: "general", messages: [{ role: "assistant", content: `Saved ${url}`, sources: [] }], interruptedTurn: null }); });
  const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox;
  let tree = h.render(Chat); question(tree).props.onChange({ target: { value: "New draft" } }); tree = h.render(Chat);
  saved(tree).props.onChange({ target: { value: "conversation-a" } }); await tick(); tree = h.render(Chat);
  assert.equal(question(tree).props.value, ""); question(tree).props.onChange({ target: { value: "Draft A" } }); tree = h.render(Chat);
  saved(tree).props.onChange({ target: { value: "conversation-b" } }); await tick(); tree = h.render(Chat);
  saved(tree).props.onChange({ target: { value: "conversation-a" } }); await tick(); tree = h.render(Chat); assert.equal(question(tree).props.value, "Draft A");
  button(tree, "New conversation").props.onClick(); tree = h.render(Chat); assert.equal(question(tree).props.value, "New draft"); assert.ok(calls.every(([, method]) => method !== "POST"));
});

test("failed conversation reads retain the current draft and messages", async t => {
  const h = harness(t, async () => { throw new Error("offline"); }); const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox;
  let tree = h.render(Chat); question(tree).props.onChange({ target: { value: "Preserve me" } }); tree = h.render(Chat); saved(tree).props.onChange({ target: { value: "another" } }); await tick(); tree = h.render(Chat);
  assert.equal(question(tree).props.value, "Preserve me"); assert.match(text(tree), /draft are preserved/); assert.equal(button(tree, "Send").props.disabled, false);
});

test("rapid Send clicks produce one AI request; network failure keeps its question and retry identity", async t => {
  const payloads = []; const h = harness(t, async (url, init) => { if (url === "/api/chat") { payloads.push(JSON.parse(init.body)); throw new Error("offline"); } return Response.json({ conversations: [] }); });
  const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox; let tree = h.render(Chat); question(tree).props.onChange({ target: { value: "Question" } }); tree = h.render(Chat);
  const send = button(tree, "Send").props.onClick; send(); send(); await tick(); tree = h.render(Chat); assert.equal(payloads.length, 1); assert.equal(question(tree).props.value, "Question");
  assert.equal(button(tree, "Send").props.disabled, true); button(tree, "Retry same request").props.onClick(); await tick(); assert.equal(payloads.length, 2); assert.deepEqual(payloads[0], payloads[1]);
});

test("scrolling older messages suppresses auto-scroll until the user explicitly jumps", t => {
  const h = harness(t); const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox; let tree = h.render(Chat);
  const log = nodes(tree, node => node.props?.["aria-label"] === "Conversation messages")[0]; const element = { scrollTop: 10, scrollHeight: 1000, clientHeight: 200 }; log.props.ref.current = element;
  log.props.onScroll({ currentTarget: element }); tree = h.render(Chat); button(tree, "Jump to latest message").props.onClick(); assert.equal(element.scrollTop, 1000);
  assert.equal(nodes(tree, node => node.props?.["aria-live"] && node.props?.["aria-label"] === "Conversation messages").length, 0);
});

test("interrupted turn recovery is explicit and does not generate a replacement answer", async t => {
  const calls = []; let recovered = false;
  const h = harness(t, async (url, init) => { calls.push([url, init?.method]); if (url.endsWith("/recover")) { recovered = true; return Response.json({ question: "Original", notice: "Previous execution fenced" }); } return Response.json({ contextKey: "general", messages: [], interruptedTurn: recovered ? null : { id: "turn", question: "Original", status: "RUNNING" } }); });
  const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox; let tree = h.render(Chat); saved(tree).props.onChange({ target: { value: "conversation-a" } }); await tick(); tree = h.render(Chat);
  assert.equal(button(tree, "Send").props.disabled, true); assert.equal(recovered, false); button(tree, "Recover turn and prepare a new request").props.onClick(); await tick(); tree = h.render(Chat);
  assert.equal(question(tree).props.value, "Original"); assert.match(text(tree), /Previous execution fenced/); assert.equal(calls.filter(([, method]) => method === "POST").length, 1); assert.ok(calls.every(([url]) => url !== "/api/chat"));
});

test("checkout double clicks invoke once and an uncertain outcome never auto-retries", async t => {
  let calls = 0; const h = harness(t, async () => { calls++; throw new Error("lost"); }); const Checkout = h.load("src/components/billing/CheckoutButton.tsx").CheckoutButton;
  let tree = h.render(Checkout); const click = button(tree, "Upgrade to Pro").props.onClick; const first = click(); await click(); await first; tree = h.render(Checkout);
  assert.equal(calls, 1); assert.match(text(tree), /before trying again/); assert.equal(nodes(tree, node => node.props?.role === "alert").length, 1); await tick(); assert.equal(calls, 1);
});

test("logout failure is visible and does not navigate away", async t => {
  let pushes = 0; const h = harness(t, async () => Response.json({}, { status: 503 }), { "next/navigation": { useRouter: () => ({ push() { pushes++; }, refresh() {} }) } });
  const Logout = h.load("src/components/layout/LogoutButton.tsx").LogoutButton; await button(h.render(Logout), "Logout").props.onClick(); const tree = h.render(Logout); assert.equal(pushes, 0); assert.match(text(tree), /Could not confirm sign-out/);
});

for (const user of [null, { plan: "FREE", subscriptionStatus: null }, { plan: "PRO", subscriptionStatus: "active" }, { plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(0) }, { plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(Date.now() + 86400000) }]) test(`checkout return uses server state, never asserts payment success: ${JSON.stringify(user)}`, async t => {
  let reads = 0; const h = harness(t, undefined, { "@/lib/auth": { getCurrentUser: async () => { reads++; return user; } } });
  const Page = h.load("src/app/pro/success/page.tsx").default; const tree = await Page(); assert.equal(reads, 1); assert.doesNotMatch(text(tree), /Payment completed|payment successful|Stripe has completed/i);
  if (user?.plan === "PRO" && user.billingAccessUntil > new Date()) assert.match(text(tree), /Pro access is active/);
  else assert.match(text(tree), /Payment has not been confirmed/);
});

test("read recovery distinguishes expired sessions from offline errors and only calls the supplied read", t => {
  const h = harness(t); const ReadError = h.load("src/components/layout/ReadError.tsx").ReadError; let calls = 0;
  let tree = ReadError({ message: "Offline", authenticationRequired: false, retry() { calls++; } }); assert.equal(nodes(tree, node => node.props?.href === "/login").length, 0); button(tree, "Try loading again").props.onClick(); assert.equal(calls, 1);
  tree = ReadError({ message: "Expired", authenticationRequired: true, retry() { calls++; } }); assert.equal(nodes(tree, node => node.type === "button").length, 0); assert.equal(nodes(tree, node => node.props?.href === "/login").length, 1);
});

test("Pro presentation derives its allowance from the configured value and leaves prices intact", t => {
  const h = harness(t); const { productCopy } = h.load("src/lib/productCopy.ts"); const { FULL_ACCESS_DAILY_CHAT_LIMIT } = h.load("src/lib/features.ts");
  assert.ok(productCopy.proPlan.features.includes(`${FULL_ACCESS_DAILY_CHAT_LIMIT} AI questions per day`)); assert.equal(productCopy.proPlan.price, "$7.99/month"); assert.equal(productCopy.proPlan.yearlyPrice, "$69/year"); assert.doesNotMatch(JSON.stringify(productCopy), /unlimited/i);
});

test("shared CSS supplies visible focus, reduced motion and overflow wrapping without hiding content", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8"); assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /overflow-wrap: anywhere/); assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});

test("initial chat loading performs GETs only and announces readiness", async t => {
  const calls = [];
  const h = harness(t, async (url, init) => { calls.push([url, init?.method]); return Response.json(url.includes("usage")
    ? { quota: { pool: "chat", limit: 5, used: 5, remaining: 0, observedAt: "2026-10-19T12:00:00Z", resetsAt: "2026-10-20T00:00:00Z", timezone: "UTC" } }
    : { conversations: [], interruptedConversationIds: [] }); });
  const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox;
  h.render(Chat); h.flushEffects(); await tick(); const tree = h.render(Chat);
  assert.ok(calls.length >= 2); assert.ok(calls.every(([, method]) => !method || method === "GET"));
  assert.match(text(tree), /Questions remaining today: 0/); assert.ok(nodes(tree, node => node.props?.role === "status").length); h.cleanup();
});

test("an aborted initial quota read cannot update the abandoned view", async t => {
  let release; const oldRead = new Promise(resolve => { release = resolve; });
  const quota = { pool: "chat", limit: 5, used: 1, remaining: 4, observedAt: "2026-10-19T12:00:00Z", resetsAt: "2026-10-20T00:00:00Z", timezone: "UTC" };
  const h = harness(t, async (url, init) => {
    if (url.includes("usage")) { await oldRead; return Response.json({ quota }); }
    if (url === "/api/chat" && init) return Response.json({ answer: "Answer", conversationId: "thread", quota: { ...quota, used: 2, remaining: 3, observedAt: "2026-10-19T12:01:00Z" } });
    return Response.json({ conversations: [] });
  });
  // A late response on an abandoned mount must not alter the next interaction.
  const Chat = h.load("src/components/chat/ChatBox.tsx").ChatBox; h.render(Chat); h.flushEffects(); await tick(); h.cleanup(); release(); await tick();
  let tree = h.render(Chat); assert.doesNotMatch(text(tree), /Questions remaining today: 4/);
});

test("failed journal saves retain the typed title and reflection without automatic replay", async t => {
  let posts = 0; const h = harness(t, async (url, init) => {
    if (init?.method === "POST") { posts++; throw new Error("offline"); }
    return Response.json(url === "/api/journal" ? { entries: [] } : {});
  });
  const Journal = h.load("src/app/journal/page.tsx").default; h.render(Journal); h.flushEffects(); await tick(); let tree = h.render(Journal);
  nodes(tree, node => node.type === "input")[0].props.onChange({ target: { value: "Private title" } }); question(tree).props.onChange({ target: { value: "Private reflection" } }); tree = h.render(Journal);
  await button(tree, "Save entry").props.onClick(); tree = h.render(Journal);
  assert.equal(nodes(tree, node => node.type === "input")[0].props.value, "Private title"); assert.equal(question(tree).props.value, "Private reflection"); assert.match(nodes(tree, node => typeof node.props?.message === "string")[0].props.message, /Could not confirm the save/);
  await tick(); assert.equal(posts, 1); h.cleanup();
});

test("failed plan generation preserves both input and the preceding successful plan", async t => {
  let posts = 0; const h = harness(t, async () => { posts++; return posts === 1 ? Response.json({ plan: "Original saved plan" }) : Response.json({ error: "Temporarily unavailable" }, { status: 503 }); });
  const Plan = h.load("src/components/pro/PrayerPlanForm.tsx").PrayerPlanForm;
  let tree = h.render(Plan); await button(tree, "Create prayer plan").props.onClick(); tree = h.render(Plan); assert.match(text(tree), /Original saved plan/);
  question(tree).props.onChange({ target: { value: "My new focus" } }); tree = h.render(Plan); await button(tree, "Create prayer plan").props.onClick(); tree = h.render(Plan);
  assert.equal(question(tree).props.value, "My new focus"); assert.match(text(tree), /Original saved plan/); assert.equal(posts, 2);
});

test("history does not present an upgrade or empty state before access has loaded or after a failure", async t => {
  const h = harness(t, async () => Response.json({ error: "Unavailable" }, { status: 503 })); const History = h.load("src/app/history/page.tsx").default;
  let tree = h.render(History); assert.doesNotMatch(text(tree), /No conversation history yet/); assert.equal(nodes(tree, node => node.props?.title === "Pro feature: Extended Conversation History").length, 0);
  h.flushEffects(); await tick(); tree = h.render(History); assert.doesNotMatch(text(tree), /No conversation history yet/); assert.equal(nodes(tree, node => node.props?.title === "Pro feature: Extended Conversation History").length, 0); h.cleanup();
});

test("page recovery does not expose the internal error or execute reset automatically", t => {
  const h = harness(t); const Page = h.load("src/app/error.tsx").default; let calls = 0;
  const tree = Page({ error: new Error("secret-stack-details"), reset() { calls++; } }); assert.equal(calls, 0); assert.doesNotMatch(text(tree), /secret-stack-details/);
  button(tree, "Try loading again").props.onClick(); assert.equal(calls, 1);
});

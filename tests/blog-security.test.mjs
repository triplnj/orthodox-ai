import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";
import { authHarness } from "./helpers/auth-harness.mjs";

const { sanitizeBlogHtml, renderBlogContent, plainTextToSafeHtml } =
  createLoader()("src/lib/blogContent.ts");

const verifiedAdmin = {
  id: "provisioned-admin-id",
  email: "admin@example.com",
  emailVerified: new Date("2026-01-01"),
  passwordHash: "never-return-this",
};

function harness(user, env = {}) {
  const calls = [];
  const post = {
    id: "post-id", title: "Existing title", slug: "existing-url", status: "PUBLISHED",
    content: '<p>Existing <strong>content</strong></p><img src="x" onerror="alert(1)">',
    publishedAt: new Date("2026-01-01"),
  };
  let currentUser = user;
  const blogPost = Object.fromEntries(["create", "update", "delete", "findUnique", "findFirst", "findMany"]
    .map((operation) => [operation, async (args) => {
      calls.push({ operation, args });
      return operation === "findMany" ? [post] : post;
    }]));
  const load = createLoader({
    "server-only": {},
    "@/lib/session": { getSessionUser: async () => currentUser },
    "@/lib/prisma": { prisma: { blogPost } },
    "next/navigation": {
      redirect: (location) => { throw Object.assign(new Error("redirect"), { location }); },
      notFound: () => { throw new Error("not found"); },
    },
    "next/link": { __esModule: true, default: "a" },
    "@/components/blog/BlogContentEditor": { BlogContentEditor: "blog-editor" },
  }, { BLOG_ADMIN_USER_IDS: verifiedAdmin.id, BLOG_ADMIN_EMAILS: verifiedAdmin.email, ...env });
  return { load, calls, post, setUser: (nextUser) => { currentUser = nextUser; } };
}

function postForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "post-id", title: "Existing title", slug: "existing-url", status: "PUBLISHED",
    content: '<h2>Heading</h2><p><b>Bold</b><script>alert(1)</script><a href="javascript:alert(1)">link</a></p>',
    ...overrides,
  })) form.set(key, value);
  return form;
}

function walk(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => walk(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}

for (const [name, user, env] of [
  ["anonymous", null, {}],
  ["unverified provisioned user", { ...verifiedAdmin, emailVerified: null }, {}],
  ["verified email allowlist impersonator", { ...verifiedAdmin, id: "attacker-id" }, {}],
  ["legacy email allowlist only", verifiedAdmin, { BLOG_ADMIN_USER_IDS: "" }],
  ["missing provisioning", verifiedAdmin, { BLOG_ADMIN_USER_IDS: undefined }],
]) {
  test(`${name} cannot administer blogs through direct server-action calls`, async () => {
    const { load, calls } = harness(user, env);
    assert.equal(await load("src/lib/blogAdmin.ts").getBlogAdminUser(), null);
    const actions = load("src/app/admin/blog/actions.ts");
    for (const action of ["createBlogPost", "updateBlogPost", "deleteBlogPost", "sanitizeBlogPaste"]) {
      await assert.rejects(actions[action](action === "sanitizeBlogPaste" ? "<p>x</p>" : postForm({
        email: verifiedAdmin.email, userId: verifiedAdmin.id, emailVerified: "true", role: "ADMIN",
      })), { location: "/login" });
    }
    assert.deepEqual(calls, [], "authorization must run before any post lookup or mutation");
  });
}

test("explicit provisioning requires verified ownership and returns no session secrets", async () => {
  const { load } = harness(verifiedAdmin, { BLOG_ADMIN_USER_IDS: ` , ${verifiedAdmin.id}, other-id, ` });
  assert.deepEqual(await load("src/lib/blogAdmin.ts").getBlogAdminUser(), {
    id: verifiedAdmin.id, email: verifiedAdmin.email,
  });
});

test("authorization is reevaluated for each action after verification is revoked", async () => {
  const h = harness(verifiedAdmin);
  const actions = h.load("src/app/admin/blog/actions.ts");
  h.setUser({ ...verifiedAdmin, emailVerified: null });
  await assert.rejects(actions.deleteBlogPost(postForm()), { location: "/login" });
  assert.deepEqual(h.calls, []);
});

test("all admin pages and draft metadata reject unauthorized callers before reading posts", async () => {
  const { load, calls } = harness(null);
  for (const file of [
    "src/app/admin/blog/page.tsx", "src/app/admin/blog/new/page.tsx", "src/app/admin/blog/[id]/edit/page.tsx",
  ]) {
    const page = load(file);
    const props = { params: Promise.resolve({ id: "post-id" }) };
    await assert.rejects(page.default(props), { location: "/login" });
    if (page.generateMetadata) await assert.rejects(page.generateMetadata(props), { location: "/login" });
  }
  assert.deepEqual(calls, []);
});

test("authorized create/update sanitize stored HTML and preserve slug/status/publication date", async () => {
  const { load, calls, post } = harness(verifiedAdmin);
  const actions = load("src/app/admin/blog/actions.ts");
  for (const action of ["createBlogPost", "updateBlogPost"]) {
    await assert.rejects(actions[action](postForm()), { location: "/admin/blog" });
  }
  for (const call of calls.filter((call) => ["create", "update"].includes(call.operation))) {
    assert.equal(call.args.data.slug, "existing-url");
    assert.equal(call.args.data.status, "PUBLISHED");
    assert.equal(call.args.data.authorEmail, verifiedAdmin.email);
    assert.match(call.args.data.content, /<h2>Heading<\/h2>/);
    assert.doesNotMatch(call.args.data.content, /script|javascript:|alert\(/i);
    if (call.operation === "update") assert.equal(call.args.data.publishedAt, post.publishedAt);
  }
  assert.equal(await actions.sanitizeBlogPaste('<p onclick="evil()">Safe</p>'), "<p>Safe</p>");
  const deletion = new FormData(); deletion.set("id", "post-id");
  await assert.rejects(actions.deleteBlogPost(deletion), { location: "/admin/blog" });
  assert.deepEqual(calls.at(-1), { operation: "delete", args: { where: { id: "post-id" } } });
});

test("legacy published HTML is sanitized on public render and before entering the editor", async () => {
  const { load, calls } = harness(verifiedAdmin);
  const publicPage = await load("src/app/blog/[slug]/page.tsx").default({
    params: Promise.resolve({ slug: "existing-url" }),
  });
  const [htmlNode] = walk(publicPage, (node) => Boolean(node.props?.dangerouslySetInnerHTML));
  assert.ok(htmlNode);
  assert.doesNotMatch(htmlNode.props.dangerouslySetInnerHTML.__html, /onerror/);
  assert.match(htmlNode.props.dangerouslySetInnerHTML.__html, /<strong>content<\/strong>/);
  const editPage = await load("src/app/admin/blog/[id]/edit/page.tsx").default({
    params: Promise.resolve({ id: "post-id" }),
  });
  const [editor] = walk(editPage, (node) => node.type === "blog-editor");
  assert.ok(editor);
  assert.doesNotMatch(editor.props.defaultValue, /onerror/);
  assert.ok(calls.every((call) => call.operation.startsWith("find")), "legacy reads must not rewrite posts");
});

test("Word/Docs markup preserves headings, lists, emphasis, links, quotes and safe styles", () => {
  const input = '<div><h2>Title</h2><p class="MsoNormal"><span style="font-weight:700;font-style:italic;color:red">Words</span> <strong>bold</strong> <em>italic</em></p><ol start="3"><li>One<ul><li>Nested</li></ul></li></ol><blockquote><p>Quotation</p></blockquote><a href="https://example.com/a?q=1&amp;b=2" target="_blank">Source</a></div>';
  const result = sanitizeBlogHtml(input);
  for (const expected of ["<h2>Title</h2>", "font-weight:700", "font-style:italic", '<ol start="3">', "<blockquote>", '<ul><li>Nested</li></ul>', '<strong>bold</strong>', '<em>italic</em>', 'href="https://example.com/a?q=1&amp;b=2"', 'rel="noopener noreferrer"']) {
    assert.ok(result.includes(expected), expected);
  }
  assert.doesNotMatch(result, /class=|color:/);
  assert.equal(sanitizeBlogHtml(result), result, "sanitization is idempotent");
});

for (const malicious of [
  '<script>alert(1)</script><p onclick="alert(1)">Safe</p>',
  '<img src="x" onerror="alert(1)"><iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<svg><a xlink:href="javascript:alert(1)">evil</a></svg><math><mtext>evil</mtext></math>',
  '<object data="data:text/html,evil"></object><embed src="evil"><template><img src=x onerror=alert(1)></template>',
  '<a href="javascript:alert(1)">a</a><a href="jav&#x61;script:alert(1)">b</a>',
  '<a href="java&#10;script:alert(1)">a</a><a href="vbscript:evil">b</a>',
  '<a href="data:text/html,evil">a</a><img src="data:image/svg+xml,evil">',
  '<a href="//evil.example">a</a><a href="file:///etc/passwd">b</a>',
  '<p style="background:url(javascript:evil);position:fixed;font-weight:expression(evil)">Safe</p>',
  '<form action="/api/evil"><input name="x"><button formaction="javascript:evil">Click</button></form>',
  '<!--[if gte mso 9]><script>evil</script><![endif]--><p id="clobber" name="window" data-evil="x">Safe</p>',
  '<svg><style><a id="</style><img src=x onerror=alert(1)>">',
]) {
  test(`sanitizer blocks malicious HTML: ${malicious.slice(0, 65)}`, () => {
    const clean = sanitizeBlogHtml(malicious);
    assert.doesNotMatch(clean, /<(?:script|iframe|svg|math|object|embed|template|form|input|button)\b/i);
    assert.doesNotMatch(clean, /\s(?:on\w+|srcdoc|id|name|data-evil)\s*=/i);
    assert.doesNotMatch(clean, /(?:href|src)="(?:javascript:|vbscript:|data:|file:|\/\/)/i);
    assert.doesNotMatch(clean, /expression\(|background:|position:/i);
    assert.equal(sanitizeBlogHtml(clean), clean);
  });
}

test("safe link protocols, relative URLs and fragments survive", () => {
  for (const url of ["https://example.com", "http://example.com", "mailto:priest@example.com", "tel:+1234", "/blog/existing-url", "../article", "#quotation"]) {
    assert.ok(sanitizeBlogHtml(`<a href="${url}">link</a>`).includes(`href="${url}"`));
  }
});

test("legacy plain text is escaped, retains paragraphs/newlines and cannot inject markup", () => {
  assert.equal(renderBlogContent('A & B < 5\r\nSecond line\r\n\r\n"Quote"'),
    '<p>A &amp; B &lt; 5<br />Second line</p><p>&quot;Quote&quot;</p>');
  assert.equal(plainTextToSafeHtml('<img src=x onerror=evil> & "quote"'),
    '<p>&lt;img src=x onerror=evil&gt; &amp; &quot;quote&quot;</p>');
  assert.equal(renderBlogContent('&lt;script&gt;evil&lt;/script&gt;'),
    '<p>&amp;lt;script&amp;gt;evil&amp;lt;/script&amp;gt;</p>');
});

test("draft creation and unpublishing retain the original blog behavior", async () => {
  const { load, calls } = harness(verifiedAdmin);
  const actions = load("src/app/admin/blog/actions.ts");
  for (const action of ["createBlogPost", "updateBlogPost"]) {
    await assert.rejects(actions[action](postForm({ status: "DRAFT", slug: "", title: "New Title" })),
      { location: "/admin/blog" });
  }
  for (const { args } of calls.filter((call) => ["create", "update"].includes(call.operation))) {
    assert.equal(args.data.slug, "new-title");
    assert.equal(args.data.status, "DRAFT");
    assert.equal(args.data.publishedAt, null);
  }
});

test("self-registration rejects submitted admin identity and verification fields", async () => {
  const h = authHarness({ env: { BLOG_ADMIN_USER_IDS: verifiedAdmin.id } });
  const response = await h.request("auth/register", { email: verifiedAdmin.email, password: "test-password", name: "Name",
    id: verifiedAdmin.id, role: "ADMIN", emailVerified: "2026-01-01", plan: "PRO" });
  assert.equal(response.status, 400);
  assert.equal(h.state.users.length, 0);
  assert.equal(h.state.sessions.length, 0);
  assert.equal(await h.load("src/lib/blogAdmin.ts").getBlogAdminUser(), null);
});

test("ordinary login does not promote an unverified provisioned account", async () => {
  const h = authHarness({ env: { BLOG_ADMIN_USER_IDS: verifiedAdmin.id } });
  h.addUser({ ...verifiedAdmin, emailVerified: null, passwordHash: "hash:test-password" });
  const response = await h.request("auth/login", { email: verifiedAdmin.email, password: "test-password", role: "ADMIN", emailVerified: true });
  assert.equal(response.status, 400);
  assert.equal(h.state.sessions.length, 0);
  assert.equal(h.state.users[0].emailVerified, null);
  assert.equal(await h.load("src/lib/blogAdmin.ts").getBlogAdminUser(), null);
});
for (const state of ["missing", "invalid", "expired", "valid"]) {
  test(`${state} database session is respected by the real admin authorization helper`, async () => {
    const deleted = [];
    const load = createLoader({
      "next/headers": { cookies: async () => ({
        get: () => state === "missing" ? undefined : { value: "a".repeat(64) },
      }) },
      "@/lib/prisma": { prisma: { session: {
        findUnique: async () => state === "invalid" ? null : {
          id: "session-id", user: verifiedAdmin,
          expiresAt: new Date(Date.now() + (state === "expired" ? -60000 : 60000)),
        },
        deleteMany: async (args) => { deleted.push(args); },
      } } },
    }, { BLOG_ADMIN_USER_IDS: verifiedAdmin.id });
    const result = await load("src/lib/blogAdmin.ts").getBlogAdminUser();
    assert.equal(result?.id ?? null, state === "valid" ? verifiedAdmin.id : null);
    assert.equal(deleted.length, state === "expired" ? 1 : 0);
  });
}

test("rich paste waits for server sanitization before inserting HTML into the editor", async () => {
  const commands = [];
  let resolveSanitization;
  const sanitation = new Promise((resolve) => { resolveSanitization = resolve; });
  const editor = { contains: () => true, focus: () => {} };
  const load = createLoader({
    react: {
      useEffect: () => {},
      useRef: () => ({ current: editor }),
      useState: (value) => [value, () => {}],
    },
    "@/app/admin/blog/actions": { sanitizeBlogPaste: () => sanitation },
  });
  const component = load("src/components/blog/BlogContentEditor.tsx").BlogContentEditor({ name: "content" });
  const [editable] = walk(component, (node) => node.props?.contentEditable);
  const savedWindow = globalThis.window;
  const savedDocument = globalThis.document;
  globalThis.window = { getSelection: () => ({
    rangeCount: 1, getRangeAt: () => ({ cloneRange: () => ({ commonAncestorContainer: editor }) }),
    removeAllRanges: () => {}, addRange: () => {},
  }) };
  globalThis.document = { execCommand: (...args) => { commands.push(args); } };
  try {
    let prevented = false;
    const pending = editable.props.onPaste({
      preventDefault: () => { prevented = true; },
      clipboardData: { getData: (format) => format === "text/html" ? '<p onclick="evil()">Safe</p>' : "Safe" },
    });
    assert.equal(prevented, true);
    assert.deepEqual(commands, []);
    resolveSanitization(sanitizeBlogHtml('<p onclick="evil()">Safe</p>'));
    await pending;
    assert.deepEqual(commands, [["insertHTML", false, "<p>Safe</p>"]]);
    let dropPrevented = false;
    editable.props.onDrop({ preventDefault: () => { dropPrevented = true; } });
    assert.equal(dropPrevented, true);
  } finally {
    if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
    if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
  }
});

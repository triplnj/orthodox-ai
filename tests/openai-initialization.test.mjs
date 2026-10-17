import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mock, test } from "node:test";
import ts from "typescript";
import { createLoader } from "./helpers/load-ts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mock.method(globalThis, "fetch", () => { throw new Error("Network calls forbidden in initialization tests"); });
const affected = [
  "src/lib/ai/chatService.ts",
  ...[
    "backfill-translations", "build-greek-search-terms", "build-text-search-terms",
    "clean-pg-ocr", "embeddings", "extract-quotes", "resolve-pg-author",
    "translate-pg-passages", "verify-attribution", "verify-cleaned-pg",
    "verify-second-source", "web-patristic-research",
  ].map((name) => `src/lib/patristics/${name}.ts`),
];

function harness({ failConstruction = false } = {}) {
  const constructions = [];
  const requests = [];
  const database = new Proxy({}, { get: () => { throw new Error("Database access forbidden in this test"); } });
  class MockOpenAI {
    constructor(options) {
      constructions.push(options);
      if (failConstruction) throw new Error("SDK initialization failed");
      this.embeddings = { create: async (...args) => {
        requests.push({ kind: "embedding", args });
        return { data: [{ embedding: [0.1, 0.2] }] };
      } };
      this.chat = { completions: { create: async (...args) => {
        requests.push({ kind: "chat", args });
        return { choices: [{ message: { content: "Mock answer" } }] };
      } } };
      this.responses = { parse: async (...args) => {
        requests.push({ kind: "parse", args });
        return { output_parsed: { translationSr: "Mock Serbian", translationEn: "Mock English" } };
      } };
    }
  }
  const load = createLoader({
    "server-only": {},
    openai: { __esModule: true, default: MockOpenAI },
    "@/lib/prisma": { prisma: database },
    "@/lib/session": { getSessionUser: async () => null },
    // PDF parsing is unrelated to initialization and must not load native workers.
    "pdf-parse": { PDFParse: class {} },
    "pdf-parse/worker": { CanvasFactory: class {} },
  }, {
    OPENAI_API_KEY: undefined,
    OPENAI_ADMIN_KEY: undefined,
    PATRISTICS_MODEL: "existing-research-model",
  });
  return { load, constructions, requests };
}

for (const file of affected) {
  test(`imports ${file} without credentials, SDK construction, database access, or API calls`, () => {
    const { load, constructions, requests } = harness();
    assert.doesNotThrow(() => load(file));
    assert.deepEqual(constructions, []);
    assert.deepEqual(requests, []);
  });
}

test("the originally failing route imports without credentials and rejects unauthorized requests", async () => {
  const { load, constructions, requests } = harness();
  const route = load("src/app/api/admin/patristics/backfill-translations/route.ts");
  const response = await route.POST(new Request("https://example.com/api/admin/patristics/backfill-translations", {
    method: "POST",
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(constructions, []);
  assert.deepEqual(requests, []);
});

test("missing runtime credentials raise a stable configuration error without constructing the SDK", async () => {
  const { load, constructions } = harness();
  const { getOpenAI, OpenAIConfigurationError } = load("src/lib/ai/openaiClient.ts");
  const check = (error) => error instanceof OpenAIConfigurationError && error.code === "OPENAI_NOT_CONFIGURED";
  assert.throws(getOpenAI, check);
  await assert.rejects(load("src/lib/patristics/embeddings.ts").createEmbedding("test"), check);
  await assert.rejects(load("src/lib/ai/chatService.ts").generateOrthodoxAnswer({ userMessage: "test" }), check);
  assert.deepEqual(constructions, []);
});

test("first use reads runtime configuration and caches one client shared by consumers", async () => {
  const { load, constructions, requests } = harness();
  const helper = load("src/lib/ai/openaiClient.ts");
  const embeddings = load("src/lib/patristics/embeddings.ts");
  const chat = load("src/lib/ai/chatService.ts");
  assert.deepEqual(constructions, []);
  assert.throws(helper.getOpenAI, { code: "OPENAI_NOT_CONFIGURED" });

  // Opaque test doubles, never credentials or strings supplied to a real SDK.
  const mockCredential = Symbol("mock credential presence");
  load.environment.OPENAI_API_KEY = mockCredential;
  const client = helper.getOpenAI();
  assert.equal(helper.getOpenAI(), client);
  const [vector, answer] = await Promise.all([
    embeddings.createEmbedding("input"),
    chat.generateOrthodoxAnswer({ userMessage: "Question", isPro: true }),
  ]);
  assert.equal(constructions.length, 1);
  assert.deepEqual(constructions[0], { apiKey: mockCredential });
  assert.deepEqual(vector, [0.1, 0.2]);
  assert.deepEqual(answer, { answer: "Mock answer" });
  assert.equal(requests.find((request) => request.kind === "embedding").args[0].model, "text-embedding-3-small");
  assert.equal(requests.find((request) => request.kind === "chat").args[0].model, "gpt-4.1-mini");
});

test("existing admin-key fallback remains supported without an API key", () => {
  const { load, constructions } = harness();
  load.environment.OPENAI_ADMIN_KEY = Symbol("mock admin credential presence");
  assert.ok(load("src/lib/ai/openaiClient.ts").getOpenAI());
  assert.deepEqual(constructions, [{ apiKey: undefined }]);
});

test("SDK initialization failures are not cached", () => {
  const { load, constructions } = harness({ failConstruction: true });
  load.environment.OPENAI_API_KEY = Symbol("mock credential presence");
  const { getOpenAI } = load("src/lib/ai/openaiClient.ts");
  assert.throws(getOpenAI, /SDK initialization failed/);
  assert.throws(getOpenAI, /SDK initialization failed/);
  assert.equal(constructions.length, 2);
});

test("translation retains its configured model and structured-output contract", async () => {
  const { load, requests } = harness();
  load.environment.OPENAI_API_KEY = Symbol("mock credential presence");
  const result = await load("src/lib/patristics/backfill-translations.ts").translateQuote("original", "Greek");
  assert.deepEqual(result, { translationSr: "Mock Serbian", translationEn: "Mock English" });
  assert.equal(requests[0].args[0].model, "existing-research-model");
  assert.equal(requests[0].args[0].text.format.name, "patristic_translation");
  assert.equal(requests[0].args[0].input[1].content, "original");
});

test("server-only boundary rejects imports without server conditions", () => {
  const load = createLoader();
  const source = fs.readFileSync(path.join(root, "src/lib/ai/openaiClient.ts"), "utf8");
  const ast = ts.createSourceFile("openaiClient.ts", source, ts.ScriptTarget.Latest, true);
  assert.equal(ast.statements[0].moduleSpecifier.text, "server-only");
  assert.throws(() => load("src/lib/ai/openaiClient.ts"), /cannot be imported from a Client Component/);
});

test("all SDK construction remains inside the lazy server initializer", () => {
  const constructions = [];
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "generated") continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { inspect(filename); continue; }
      if (!/\.tsx?$/.test(filename)) continue;
      const ast = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isNewExpression(node) && node.expression.getText(ast) === "OpenAI") {
          constructions.push(path.relative(root, filename).replaceAll("\\", "/"));
          let parent = node.parent;
          while (parent && !ts.isFunctionDeclaration(parent)) parent = parent.parent;
          assert.equal(parent?.name?.text, "getOpenAI", "SDK construction must be inside the accessor");
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  inspect(path.join(root, "src"));
  assert.deepEqual(constructions, ["src/lib/ai/openaiClient.ts"]);
});

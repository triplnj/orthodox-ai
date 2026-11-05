import test from "node:test";
import assert from "node:assert/strict";
import { main } from "../scripts/patristics/index-staging.mjs";

const env = {
  LIBRARY_STAGING_DB_URL: "postgresql://tester:secret@ep-safe.eu-central-1.aws.neon.tech/neondb",
  LIBRARY_STAGING_BRANCH_ID: "br-spring-frost-assfzje6",
  OPENAI_API_KEY: "mock-key-never-sent",
};
const edition = "edition_a5ab16669e87b05abd9219553343d318";

function mockDb({ guard = true, status = "STAGED", rows = [{ id: "one", content: "Prayer and faith" }] } = {}) {
  const statements = [];
  return {
    statements,
    async connect() { statements.push("CONNECT"); },
    async end() { statements.push("END"); },
    async query(sql, args) {
      statements.push(sql);
      if (sql.includes('FROM "LibraryStagingGuard"')) return { rows: guard ?
        [{ branchId: env.LIBRARY_STAGING_BRANCH_ID, purpose: "PATRISTIC_LIBRARY_STAGING" }] : [] };
      if (sql.includes('SELECT "importStatus"')) return { rows: [{ importStatus: status }] };
      if (sql.includes('SELECT "id","content"')) return { rows };
      if (sql.startsWith("UPDATE ")) return { rowCount: 1 };
      if (sql.includes("count(*)::integer")) return { rows: [{ count: 0 }] };
      return { rows: [] };
    },
  };
}

test("wrong database branch marker halts before any writes or API calls", async () => {
  const db = mockDb({ guard: false });
  let calls = 0;
  const ai = { embeddings: { async create() { calls++; return { data: [] }; } } };
  await assert.rejects(main(["--edition", edition], env, { db, ai }), /not the expressly approved staging branch/);
  assert.equal(calls, 0);
  assert.ok(!db.statements.some(s => s.startsWith("UPDATE") || s === "BEGIN"));
  assert.equal(db.statements.at(-1), "END");
});

test("staging worker embeds real API response shape and commits an approved edition", async () => {
  const db = mockDb();
  const ai = { embeddings: { async create(input) {
    assert.equal(input.model, "text-embedding-3-small");
    assert.deepEqual(input.input, ["Prayer and faith"]);
    return { data: [{ index: 0, embedding: Array(1536).fill(0.1) }] };
  } } };
  assert.deepEqual(await main(["--edition", edition], env, { db, ai }), { indexed: 1, remaining: 0 });
  assert.ok(db.statements.includes("BEGIN"));
  assert.ok(db.statements.includes("COMMIT"));
  assert.ok(db.statements.some(s => s.startsWith('UPDATE "LibraryPassage"')));
});

test("invalid embeddings abort before a single write", async () => {
  const db = mockDb();
  const ai = { embeddings: { async create() { return { data: [{ index: 0, embedding: [0.1] }] }; } } };
  await assert.rejects(main(["--edition", edition], env, { db, ai }), /1536/);
  assert.ok(!db.statements.includes("BEGIN"));
});

test("already active editions cannot be re-embedded", async () => {
  const db = mockDb({ status: "ACTIVE" });
  await assert.rejects(main(["--edition", edition], env, { db, ai: { embeddings: { create() { throw Error("must not be called"); } } } }), /remain STAGED/);
  assert.ok(!db.statements.some(s => s.startsWith("UPDATE")));
});

test("CLI requires exact staging arguments and Neon URL", async () => {
  const db = mockDb();
  await assert.rejects(main(["--edition","invalid"],env,{db}), /Usage/);
  await assert.rejects(main(["--edition",edition],{...env,LIBRARY_STAGING_DB_URL:"postgresql://admin:pass@localhost/db"},{db}),/Neon Postgres/);
  assert.equal(db.statements.length,0);
});

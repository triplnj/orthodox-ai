import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLoader } from "./helpers/load-ts.mjs";

const read = path => readFileSync(path, "utf8");

test("library schema only introduces new names and does not mutate the live chat tables", () => {
  const sql = read("scripts/patristics/sql/001_additive_library.sql");
  for (const name of ["LibraryAuthor", "LibraryWork", "LibraryEdition", "LibraryPassage"]) {
    assert.match(sql, new RegExp('CREATE TABLE IF NOT EXISTS "' + name + '"'));
  }
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|ALTER TABLE|UPDATE)\b/i);
  assert.match(sql, /'PG', 'PL', 'PHILOKALIA', 'MODERN_ORTHODOX', 'CURATED_OTHER'/);
  assert.match(sql, /"importStatus" = 'ACTIVE'/);
  const route = read("src/app/api/chat/route.ts");
  assert.doesNotMatch(route, /LibraryPassage|chunkLibraryDocument/);
});

test("chunker preserves author provenance, fixed locators and neighboring context", () => {
  const load = createLoader();
  const { chunkLibraryDocument } = load("src/lib/patristics/library/chunk-document.ts");
  const doc = {
    corpus: "MODERN_ORTHODOX",
    authorKey: "saint-john-kronstadt",
    authorName: "Saint John of Kronstadt",
    workKey: "my-life-in-christ",
    workTitle: "My Life in Christ",
    editionKey: "test-edition",
    originalLanguage: "English",
    sourceUrl: "https://example.org/edition",
    licenseNote: "test only",
    passageLocator: "Chapter 1",
    text: Array.from({ length: 20 }, (_, i) => ("Passage " + i + ". ").repeat(15)).join("\n\n"),
  };
  const rows = chunkLibraryDocument(doc, 300);
  assert.ok(rows.length > 2);
  assert.ok(rows.every(row => row.content.length <= 300));
  assert.ok(rows.every(row => row.locator === "Chapter 1"));
  assert.equal(rows[0].previousOrdinal, null);
  assert.equal(rows[0].nextOrdinal, 1);
  assert.equal(rows.at(-1).nextOrdinal, null);
  assert.equal(rows.at(-1).previousOrdinal, rows.length - 2);
});

test("offline import planning requires reviewed rights and authorship and is deterministic", () => {
  const load = createLoader();
  const { planLibraryImport } = load("src/lib/patristics/library/prepare-import.ts");
  const base = {
    corpus: "PG", authorKey: "gregory-nyssa", authorName: "Gregory of Nyssa",
    workKey: "on-the-soul", workTitle: "On the Soul and Resurrection",
    editionKey: "pg46", editionTitle: "PG volume 46", originalLanguage: "Greek",
    sourceUrl: "https://example.org/pg46", licenseNote: "example; test only",
    passageLocator: "PG 46: 11-14",
    text: "A source passage with a theological argument. ".repeat(24),
    licenseReviewed: true, attributionReviewed: true,
  };
  const one = planLibraryImport(base, 300);
  const two = planLibraryImport(base, 300);
  assert.deepEqual(one, two);
  assert.equal(one.edition.importStatus, "STAGED");
  assert.equal(one.edition.corpus, "PG");
  assert.ok(one.passages.length > 2);
  assert.ok(one.passages.every(p => /^[a-f0-9]{64}$/.test(p.contentSha256)));
  assert.ok(one.passages.every(p => p.embedding === undefined));
  assert.throws(() => planLibraryImport({...base, licenseReviewed: false}), /reviewed/);
  assert.throws(() => planLibraryImport({...base, attributionReviewed: false}), /reviewed/);
  assert.throws(() => planLibraryImport({...base, corpus: "UNKNOWN"}), /corpus/);
  assert.throws(() => planLibraryImport({...base, sourceUrl: "http://example.org"}), /HTTPS/);
  assert.throws(() => planLibraryImport({...base, passageLocator: ""}), /passageLocator/);
  assert.notEqual(planLibraryImport({...base, authorKey: "other-author"}).author.id, one.author.id);
  assert.notEqual(planLibraryImport({...base, editionKey: "another-edition"}).edition.id, one.edition.id);
});

test("staging writer is transactional, idempotent, and rejects mismatched sources", async () => {
  const load = createLoader();
  const { planLibraryImport } = load("src/lib/patristics/library/prepare-import.ts");
  const { stageLibraryImport } = load("src/lib/patristics/library/stage-import.ts");
  const doc = {
    corpus: "PHILOKALIA", authorKey: "sample-father", authorName: "Sample Father",
    workKey: "sample-work", workTitle: "Sample Work",
    editionKey: "sample-edition", editionTitle: "Source Edition", originalLanguage: "Greek",
    sourceUrl: "https://example.org/sample", licenseNote: "verified for test",
    passageLocator: "1.1", text: "A passage to test integrity.",
    licenseReviewed: true, attributionReviewed: true,
  };
  const plan = planLibraryImport(doc);
  const statements = [];
  const client = { query: async (sql, args) => {
    statements.push({ sql, args });
    if (sql.startsWith("SELECT count(*)")) return { rows: [{ total: plan.passages.length }] };
    if (sql.startsWith('SELECT "ordinal"')) return { rows: plan.passages.map(p => ({
      ordinal: p.ordinal, contentSha256: p.contentSha256,
    })) };
    return { rowCount: 1 };
  }};
  const result = await stageLibraryImport(client, plan);
  assert.equal(result.passages, plan.passages.length);
  assert.equal(statements[0].sql, "BEGIN");
  assert.equal(statements.at(-1).sql, "COMMIT");
  assert.ok(statements.every(x => !x.sql.includes("UPDATE")));
  assert.ok(statements.every(x => !x.sql.includes("DELETE")));
  assert.ok(statements.filter(x => x.sql.includes("INSERT")).every(x => x.sql.includes("ON CONFLICT")));
  const damaged = { query: async (sql) => {
    if (sql.startsWith("SELECT count(*)")) return {rows:[{total:1}]};
    if (sql.startsWith('SELECT "ordinal"')) return {rows:[{ordinal:0,contentSha256:"invalid"}]};
    return {};
  }};
  const attempted = [];
  const rejectClient = {query: async (sql,...args) => {attempted.push(sql);return damaged.query(sql,...args);}};
  await assert.rejects(stageLibraryImport(rejectClient,plan), /differs/);
  assert.equal(attempted.at(-1),"ROLLBACK");
});

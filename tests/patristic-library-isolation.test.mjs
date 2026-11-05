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

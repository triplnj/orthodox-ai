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

test("embedding worker only processes staged passages and validates vector size", async () => {
  const { indexStagedPassages } = createLoader()("src/lib/patristics/library/stage-embeddings.ts");
  const statements = [];
  const client = {query: async (sql, params) => {
    statements.push({sql,params});
    if (sql.startsWith('SELECT')) return {rows:[{id:"p1",content:"Greek patristic passage"}]};
    if (sql.startsWith('UPDATE')) return {rowCount:1};
    return {};
  }};
  const count = await indexStagedPassages(client,"ed1",async () => Array(1536).fill(0.01));
  assert.equal(count,1);
  assert.ok(statements[0].sql.includes("e.\"importStatus\"='STAGED'"));
  assert.ok(statements.some(q => q.sql.startsWith("UPDATE") && q.sql.includes("e.\"importStatus\"='STAGED'")));
  assert.equal(statements.at(-1).sql,"COMMIT");
  const bad = {query:async sql => sql.startsWith("SELECT") ?
    {rows:[{id:"p1",content:"sample"}]} : {}};
  await assert.rejects(indexStagedPassages(bad,"ed1",async () => [0.1]),/1536/);
  await assert.rejects(indexStagedPassages(bad,"ed1",async () =>
    Array(1536).fill(Number.NaN)),/finite/);
});

test("new semantic library search reads only ACTIVE editions with author filters", async () => {
  const load = createLoader();
  const { searchLibraryPassages } = load("src/lib/patristics/library/search-library.ts");
  const received = [];
  const db = { query: async (sql, args) => {
    received.push({ sql, args });
    return { rows: [{
      passageId: "p", authorName: "St. Gregory of Nyssa",
      workTitle: "On the Soul and the Resurrection", corpus: "PG",
      editionTitle: "Historical edition", sourceUrl: "https://example.org",
      locator: "PG 46", content: "Main excerpt",
      previousContent: "Previous argument", nextContent: "Next argument", score: 0.9,
    }] };
  } };
  const vector = [1, ...Array(1535).fill(0)];
  const result = await searchLibraryPassages(db, vector, { authorId: "gregory", corpus: "PG", limit: 3 });
  assert.equal(result.length, 1);
  assert.equal(result[0].previousContent, "Previous argument");
  assert.ok(received[0].sql.includes('e."importStatus" = \'ACTIVE\''));
  assert.ok(received[0].sql.includes('w."authorId" = $2'));
  assert.ok(received[0].sql.includes('e."corpus" = $3'));
  assert.equal(received[0].args[1], "gregory");
  assert.equal(received[0].args[2], "PG");
  assert.equal(received[0].args[3], 3);
  await assert.rejects(searchLibraryPassages(db, [1,2]), /1536/);
  await assert.rejects(searchLibraryPassages(db, vector, { limit: 999 }), /limit/);
});
test("source registry is additive discovery metadata, not imported content", () => {
  const load = createLoader();
  const { LIBRARY_COLLECTION_CANDIDATES } = load("src/lib/patristics/library/source-registry.ts");
  const types = LIBRARY_COLLECTION_CANDIDATES.map(x => x.corpus);
  for (const type of ["PG", "PL", "PHILOKALIA", "MODERN_ORTHODOX"]) {
    assert.ok(types.includes(type));
  }
  assert.ok(LIBRARY_COLLECTION_CANDIDATES.every(x => x.review === "EDITION_BY_EDITION"));
  assert.ok(LIBRARY_COLLECTION_CANDIDATES.every(x => x.catalogueUrl.startsWith("https://")));
});

test("whole-work planning keeps chapter locators separate and rejects edition mixing", () => {
  const load = createLoader();
  const { planLibraryWorkImport } = load("src/lib/patristics/library/prepare-work-import.ts");
  const base = {
    corpus:"CURATED_OTHER", authorKey:"gregory-nyssa", authorName:"St. Gregory of Nyssa",
    workKey:"soul-resurrection", workTitle:"On the Soul and the Resurrection",
    editionKey:"npnf-1893", editionTitle:"NPNF 1893", originalLanguage:"English",
    sourceUrl:"https://example.org/primary-source", licenseNote:"1893 translation reviewed",
    licenseReviewed:true, attributionReviewed:true,
  };
  const sections = [
    {...base,passageLocator:"Chapter 1",text:"The initial argument. ".repeat(45)},
    {...base,passageLocator:"Chapter 2",text:"The response to the objection. ".repeat(45)},
  ];
  const plan = planLibraryWorkImport(sections,300);
  assert.equal(plan.sectionCount,2);
  assert.equal(plan.edition.importStatus,"STAGED");
  assert.ok(plan.passages.some(p => p.locator === "Chapter 1" && p.ordinal === 0));
  assert.ok(plan.passages.some(p => p.locator === "Chapter 2" && p.ordinal === 0));
  assert.equal(new Set(plan.passages.map(p=>p.id)).size,plan.passages.length);
  assert.throws(()=>planLibraryWorkImport([...sections, sections[0]],300),/Duplicate section/);
  assert.throws(()=>planLibraryWorkImport([
    sections[0],{...sections[1],editionKey:"different-edition"}
  ],300),/same author/);
  assert.throws(()=>planLibraryWorkImport([]),/identified sections/);
});

test("whole-work staging verifies metadata and hashes before committing", async () => {
  const load = createLoader();
  const { planLibraryWorkImport } = load("src/lib/patristics/library/prepare-work-import.ts");
  const { stageLibraryWorkImport } = load("src/lib/patristics/library/stage-work-import.ts");
  const base = {
    corpus:"PL",authorKey:"test",authorName:"Test Author",
    workKey:"work",workTitle:"Test Work",editionKey:"ed",editionTitle:"Test Edition",
    originalLanguage:"Latin",sourceUrl:"https://example.org/source",
    licenseNote:"test",licenseReviewed:true,attributionReviewed:true,
  };
  const plan = planLibraryWorkImport([
    {...base,passageLocator:"section A",text:"Latin sentence for testing."},
    {...base,passageLocator:"section B",text:"Another Latin sentence for testing."},
  ]);
  const e=plan.edition;
  const stored={
    workId:e.workId,corpus:e.corpus,editionTitle:e.editionTitle,
    originalLanguage:e.originalLanguage,sourceUrl:e.sourceUrl,
    licenseNote:e.licenseNote,importStatus:"STAGED",
    title:plan.work.title,authorId:plan.author.id,
    canonicalName:plan.author.canonicalName,
  };
  const calls=[];
  const db={query:async (sql,args)=>{
    calls.push({sql,args});
    if (sql.includes('SELECT e."workId"')) return {rows:[stored]};
    if (sql.includes('SELECT p."locator"')) return {rows:plan.passages.map(p=>({
      locator:p.locator,ordinal:p.ordinal,contentSha256:p.contentSha256,language:p.language
    }))};
    return {rowCount:1};
  }};
  assert.deepEqual(await stageLibraryWorkImport(db,plan),{sections:2,passages:2});
  assert.equal(calls[0].sql,"BEGIN");
  assert.equal(calls.at(-1).sql,"COMMIT");
  const rollbackCalls=[];
  const wrongDb={query:async (sql)=>{
    rollbackCalls.push(sql);
    if (sql.includes('SELECT e."workId"')) return {rows:[{...stored,sourceUrl:"https://different.org"}]};
    return {rowCount:1};
  }};
  await assert.rejects(stageLibraryWorkImport(wrongDb,plan),/metadata mismatch/);
  assert.equal(rollbackCalls.at(-1),"ROLLBACK");
  assert.ok(!rollbackCalls.some(sql=>sql.startsWith('INSERT INTO "LibraryPassage"')));
});

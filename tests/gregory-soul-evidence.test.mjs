import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const passage = "The soul is not dissolved with the body. ".repeat(25) +
  "There is nothing, then, to hinder the soul's presence in the body's atoms, whether fused in union or decomposed in dissolution. " +
  "The soul remains attached to its elements after death. ".repeat(16);

const load = createLoader({
  "@/lib/diagnostics": { diagnostic: () => {}, failureCategory: () => "unexpected" },
  "./fetch-source": { fetchSourceText: async url => {
    assert.match(url, /newadvent.org\/fathers\/2915.htm/);
    return { text: passage, html: "<html></html>", title: "On the Soul and the Resurrection", url };
  } },
  "./search-wikisource-collection": { searchWikisourceCollection: async () => [] },
});
const source = load("src/lib/patristics/search-curated-texts.ts");
test("Gregory's own discussion of soul/body continuity is in retrieved evidence", async () => {
  const rows = await source.searchCuratedPatristicTexts(
    "Шта Свети Григорије Ниски учи о души и телу након распадања тела?",
    5,
  );
  assert.ok(rows.length);
  assert.ok(rows.some(row => row.sourceUrl === "https://www.newadvent.org/fathers/2915.htm"));
  assert.ok(rows.some(row => row.excerpt.includes("soul's presence in the body's atoms")));
  assert.ok(rows.every(row => row.authorName === "St. Gregory of Nyssa"));
});

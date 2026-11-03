import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const firstUrl = "https://www.oca.org/saints/lives?q=john";
const lifeUrl = "https://www.oca.org/saints/lives/2027/12/20/103598-repose-of-saint-john-of-kronstadt";
const html = '<html><body><a href="/saints/lives/2027/12/20/103598-repose-of-saint-john-of-kronstadt">Read the Life</a></body></html>';
const requested = [];
const load = createLoader({
  "./fetch-source": { fetchSourceText: async url => {
    requested.push(url);
    if (url === firstUrl) return { html, text: "Search results", title: "Search" };
    if (url === lifeUrl) return { html: "", title: "Repose of Saint John of Kronstadt", text: "Saint John of Kronstadt lived as a priest who served the people of Kronstadt. ".repeat(10) };
    throw new Error("Unknown source");
  } },
});
const discovery = load("src/lib/patristics/discover-official-saint-life.ts");

test("saint name discovery accepts alternate spellings and scripts", () => {
  assert.deepEqual(Array.from(discovery.saintSubject("Who is st John of Kronstat?")), ["john","kronstat"]);
  assert.deepEqual(Array.from(discovery.saintSubject("Ко је свети Јован Кронштатски и која су његова дела?")), ["john","kronstatski"]);
});

test("official life discovery checks a matching page and preserves provenance", async () => {
  const items = await discovery.discoverOfficialSaintLife("Who is st John of Kronstat?");
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceUrl, lifeUrl);
  assert.equal(items[0].documentType, "BIBLIOGRAPHIC");
  assert.ok(requested.includes(lifeUrl));
});

test("an unsupported person cannot be substituted by a different saint", async () => {
  const items = await discovery.discoverOfficialSaintLife("Who is st Martin of Unknownville?");
  assert.equal(items.length, 0);
});

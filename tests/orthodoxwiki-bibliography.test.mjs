import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const requested = [];
const html = `<html><head><title>Justin (Popovich) - OrthodoxWiki</title></head><body>
<h2><span>Works</span></h2>
<ul><li>Dogmatics of the Orthodox Church</li><li>Lives of the Saints</li></ul>
<h2><span>External links</span></h2><ul><li>A book about Justin Popovich</li></ul>
</body></html>`;
const load = createLoader({
  "@/lib/security/source-transport": { safeSourceFetch: async url => {
    requested.push(url);
    return { ok: true, json: async () => ({
      query: { search: [{ title: "Justin (Popovich)" }, { title: "Basil the Great" }] },
    }) };
  } },
  "./fetch-source": { fetchSourceText: async url => ({
    url, title: "Justin (Popovich) - OrthodoxWiki", html,
    text: "Justin (Popovich) is a Serbian Orthodox theologian.",
  }) },
});
const discovery = load("src/lib/patristics/discover-orthodoxwiki-bibliography.ts");

test("Serbian genitive names produce English search variants", () => {
  const terms = discovery.orthodoxWikiSearchTerms("Јустина Поповића");
  assert.ok(terms.includes("justin popovic"));
  assert.ok(terms.includes("justin popovich"));
});
test("different Church Fathers cannot be substituted", () => {
  assert.equal(discovery.samePerson("Basil the Great", "Јустина Поповића"), false);
  assert.equal(discovery.samePerson("Justin (Popovich)", "Јустина Поповића"), true);
});
test("retrieval extracts only the author bibliography with an exact source URL", async () => {
  const rows = await discovery.discoverOrthodoxWikiBibliography("Наведи сва дела светог Јустина Поповића");
  assert.equal(rows.length, 1);
  assert.match(rows[0].excerpt, /Dogmatics of the Orthodox Church/);
  assert.match(rows[0].excerpt, /Lives of the Saints/);
  assert.doesNotMatch(rows[0].excerpt.split("BIOGRAPHICAL TEXT:")[0], /A book about Justin Popovich/);
  assert.ok(rows[0].sourceUrl.includes("orthodoxwiki.org/Justin_(Popovich)"));
  assert.ok(requested.some(url => url.includes("srsearch=justin+popovic")));
});

test("bibliography search recognizes extended Serbian question", async () => {
  const items = await discovery.discoverOrthodoxWikiBibliography("Наведи сва дела светог Јустина Поповића чији се наслови могу пронаћи на интернету.");
  assert.equal(items.length, 1);
  assert.match(items[0].excerpt, /Lives of the Saints/);
});

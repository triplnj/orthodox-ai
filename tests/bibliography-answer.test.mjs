import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

const builder = createLoader({})("src/lib/patristics/bibliography-answer.ts");
const evidence = {
  sources: [{
    authorName: "Justin Popovich",
    verificationStatus: "COMMUNITY_EDITED_BIBLIOGRAPHIC_SOURCE",
    metadata: { excerpt: [
      "OrthodoxWiki entry: Justin Popovich",
      "WORKS LISTED IN THIS PAGE (preserve titles exactly; do not invent additional titles):",
      "- Dogmatics of the Orthodox Church, I-III",
      "- Hagiographies of the Saints, I-XII",
      "BIOGRAPHICAL TEXT:",
      "Saint Justin is the author.",
    ].join("\n") },
  }],
};
test("bib-list questions are classified without hardcoding a Father", () => {
  assert.equal(builder.isBibliographyListingQuestion("Наведи сва дела светог Јустина Поповића"), true);
  assert.equal(builder.isBibliographyListingQuestion("Наведи дела светог Василија Великог"), true);
  assert.equal(builder.isBibliographyListingQuestion("А Житија светих?"), false);
});
test("source-backed listings copy exact titles and include completeness caveat", () => {
  const answer = builder.verifiedBibliographyAnswer("Наведи сва дела светог Јустина Поповића", evidence);
  assert.match(answer, /Hagiographies of the Saints, I-XII/);
  assert.match(answer, /Dogmatics of the Orthodox Church, I-III/);
  assert.match(answer, /не потпуна библиографија/);
  assert.doesNotMatch(answer, /Богоносни Христослов/);
});
test("no confirmed bibliography cannot generate titles", () => {
  assert.equal(builder.verifiedBibliographyAnswer("Наведи сва дела светог Јустина Поповића", { sources: [] }), null);
});

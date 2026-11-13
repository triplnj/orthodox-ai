import test from "node:test";
import assert from "node:assert/strict";
import {createLoader} from "./helpers/load-ts.mjs";
const {expandCuratedSearchTerms}=createLoader({})("src/lib/patristics/expand-curated-search-terms.ts");
test("Serbian question about parents and children retrieves relevant English passages",()=>{
 const terms=expandCuratedSearchTerms("Шта учи свети Јован Златоусти о улози родитеља у васпитању деце?",[],"English");
 assert.ok(terms.includes("children"));
 assert.ok(terms.includes("parents"));
 assert.ok(terms.includes("discipline"));
});

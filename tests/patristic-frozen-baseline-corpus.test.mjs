import test from "node:test";
import assert from "node:assert/strict";
import {FROZEN_INDEXED_EDITIONS,FROZEN_INDEXED_SQL,FROZEN_TOTAL_SQL,FROZEN_INDEXED_COUNT,FROZEN_TOTAL_COUNT} from "../scripts/patristics/frozen-baseline-corpus.mjs";
import {runEvidenceBenchmark} from "../scripts/patristics/evaluate-30-evidence-staging.mjs";
import {runHoldoutBenchmark} from "../scripts/patristics/evaluate-12-holdout-staging.mjs";
test("original historical retrieval universe is explicitly pinned to four indexed editions",()=>{
 assert.equal(FROZEN_INDEXED_EDITIONS.length,4);
 assert.equal(new Set(FROZEN_INDEXED_EDITIONS).size,4);
 assert.equal(FROZEN_INDEXED_COUNT,281);
 assert.equal(FROZEN_TOTAL_COUNT,285);
 assert.ok(FROZEN_TOTAL_SQL.includes("pilot_pl32_confessiones"));
 assert.ok(FROZEN_INDEXED_SQL.includes("edition_a5ab16669e87b05abd9219553343d318"));
 assert.ok(!FROZEN_INDEXED_SQL.includes("pilot_pl32_confessiones"));
});
test("both benchmark scripts retain frozen edition filters and never query new works",async()=>{
 const {readFileSync}=await import("node:fs");
 for(const path of ["scripts/patristics/evaluate-30-evidence-staging.mjs","scripts/patristics/evaluate-12-holdout-staging.mjs","scripts/patristics/benchmark-retrieval-staging.mjs"]){
  const src=readFileSync(path,"utf8");
  assert.ok(src.includes('IN (${FROZEN_INDEXED_SQL})'),path);
  assert.ok(src.includes('IN (${FROZEN_TOTAL_SQL})'),path);
  assert.ok(src.includes('from "./frozen-baseline-corpus.mjs"')||src.includes('from "./frozen-baseline-corpus.mjs";'),path);
 }
});

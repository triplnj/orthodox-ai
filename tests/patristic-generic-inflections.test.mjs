import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/lib/patristics/should-run-patristic-research.ts", import.meta.url), "utf8");
const match = source.match(/const DECLINED_PATRISTIC_PATTERN\s*=\s*(\/[^\n]+\/[a-z]+);/);
assert.ok(match, "Declined patristic pattern should be present");
const pattern = vm.runInNewContext(match[1]);

test("recognizes explicit Fathers requests in Serbian Latin and Cyrillic and English", () => {
  for (const query of [
    "Daj mi kratak post po nekom od svetih otaca o gnevu",
    "učenje svetih otaca o molitvi",
    "primer po jednom svetom ocu",
    "према учењу светих отаца",
    "по неком светом оцу",
    "писање отаца Цркве",
    "based on a Church Father",
    "by one Holy Father",
    "Church Father's teaching on anger",
  ]) assert.match(query, pattern, query);
});

test("does not trigger generic patristic research for unrelated requests", () => {
  for (const query of ["football results", "best coffee", "write a short poem about a river"]) {
    assert.doesNotMatch(query, pattern, query);
  }
});

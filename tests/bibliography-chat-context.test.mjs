import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";

const seed=JSON.parse(readFileSync(new URL("../src/lib/patristics/bibliography-catalog-seed.json",import.meta.url),"utf8"));
const adapter=createLoader({"./bibliography-catalog-seed.json":seed});
const {sourceBackedBibliographyContext:research}=adapter("src/lib/patristics/source-backed-bibliography.ts");

test("Nicodemus bibliographic question emits reviewed role-scoped evidence, never pending works",()=>{
 const r=research("Наведи дела светог Никодима Светогорца");
 assert.ok(r);
 assert.equal(r.providersSucceeded[0],"REVIEWED_BIBLIOGRAPHY_CATALOG");
 assert.match(r.context,/Philokalia/);
 assert.match(r.context,/EDITOR/);
 assert.match(r.context,/ADAPTOR/);
 assert.match(r.context,/SOURCE_AUTHOR/);
 assert.match(r.context,/SELECTED, NOT EXHAUSTIVE/);
 assert.doesNotMatch(r.context,/TITLE: Manual of Confession/);
 assert.doesNotMatch(r.context,/TITLE: New Synaxarion/);
 assert.ok(r.sources.length>0);
 assert.ok(r.sources.every(s=>s.verificationStatus==="REVIEWED_BIBLIOGRAPHIC_ATTRIBUTION"));
 assert.ok(r.sources.every(s=>s.sourceUrl.startsWith("https://")));
});
test("no catalog authority for unrelated subjects, unknown authors or multiple authors",()=>{
 assert.equal(research("Шта свети Никодим говори о молитви?"),null);
 assert.equal(research("Наведи дела светог Јустина Поповића"),null);
 assert.equal(research("List works by St. Nicodemus the Hagiorite and St. Macarius of Corinth"),null);
 assert.equal(research("What are your favorite books?"),null);
});
test("Scupoli must be source author rather than author of Nicodemus edition",()=>{
 const r=research("List writings of Lorenzo Scupoli");
 assert.ok(r);
 assert.match(r.context,/SOURCE_AUTHOR/);
 assert.match(r.context,/ADAPTOR/);
 assert.match(r.context,/St. Nicodemus the Hagiorite/);
});
test("research router uses current question and remains unchanged for unrelated retrieval",()=>{
 const router=readFileSync(new URL("../src/lib/patristics/build-patristic-research-context.ts",import.meta.url),"utf8");
 assert.match(router,/sourceBackedBibliographyContext\(currentQuestion\)/);
 assert.match(router,/if \(bibliography\) return bibliography/);
 assert.match(router,/researchPatristicQuestionOnWeb\(query/);
});

test("three named works receive only their reviewed work-role edges, including Pinamonti",()=>{
 const r=research("Да ли је свети Никодим Светогорац оригинални аутор Добротољубља, Невидљиве борбе и Духовних вежби?");
 assert.ok(r);
 const works=new Set(r.sources.map(x=>x.metadata.workId));
 assert.deepEqual([...works].sort(),["philokalia","spiritual-exercises","unseen-warfare"]);
 assert.match(r.context,/Giovanni Pietro Pinamonti \(SOURCE_AUTHOR\)/);
 assert.match(r.context,/NOT CATALOGUED HERE/);
 assert.doesNotMatch(r.context,/TITLE: Christian Morality/);
});

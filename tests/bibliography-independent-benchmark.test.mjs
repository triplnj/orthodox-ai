import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";
const ref=JSON.parse(fs.readFileSync("docs/qa/external-fathers-index-benchmark.json","utf8"));
const {evaluateIndexCoverage}=createLoader({})("src/lib/patristics/bibliography-benchmark.ts");
const local=JSON.parse(fs.readFileSync("src/lib/patristics/bibliography-catalog-seed.json","utf8"));

test("external frozen index baseline covers twenty named authors with over one hundred distinct title relations",()=>{
 assert.equal(new Set(ref.positive.map(x=>x.author)).size,20);
 assert.equal(ref.positive.length,106);
 assert.equal(ref.negative.length,10);
 assert.ok(ref.positive.every(x=>x.reviewStatus==="INDEX_ATTESTED_NOT_SCHOLARLY_ADJUDICATED"));
 assert.ok(ref.sourcePages.every(x=>new URL(x.url).hostname==="www.newadvent.org"));
});
test("adversarial attribution warnings are not accepted as original works",()=>{
 const score=evaluateIndexCoverage(ref.positive,
 [ref.positive[0],ref.positive[0],ref.negative[0],{author:"Unknown Person",work:"Invented Tome"}],ref.negative);
 assert.equal(score.exactIndexMatches,1);
 assert.equal(score.explicitWarningsViolated,1);
 assert.equal(score.unlistedNotNecessarilyFalse,1);
 assert.equal(score.attributionReleaseReady,false);
});
test("100 percent index coverage still does not certify a historically accurate author-role benchmark",()=>{
 const score=evaluateIndexCoverage(ref.positive,ref.positive,ref.negative);
 assert.equal(score.indexCoverage,1);
 assert.equal(score.independentlyAdjudicated,false);
 assert.equal(score.attributionReleaseReady,false);
});
test("measure present reviewed-catalogue coverage without calling LLM or external services",()=>{
 const canon=(value)=>value.normalize("NFKC").toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu," ").trim().replace(/\\s+/g," ");
 const getMatchedAuthor=(name)=>local.authors.find(a=>[a.canonicalName,...a.nameVariants].some(alias=>canon(alias)===canon(name)));
 const nameOverlap=ref.positive.filter(x=>!!getMatchedAuthor(x.author));
 const verifiedPairs=ref.positive.filter(x=>{
   const author=getMatchedAuthor(x.author);
   if(!author)return false;
   const work=local.works.find(w=>[w.canonicalTitle,w.originalTitle,...w.titleVariants].filter(Boolean).some(t=>canon(t)===canon(x.work)));
   if(!work)return false;
   return local.contributions.some(c=>c.authorId===author.id&&c.workId===work.id&&c.attribution==="SOURCE_ATTESTED"&&
     c.evidenceIds.some(eid=>local.evidence.some(e=>e.id===eid&&e.reviewStatus==="REVIEWED"&&e.kind!=="COMMUNITY_REFERENCE")));
 });
 const score=evaluateIndexCoverage(ref.positive,verifiedPairs,ref.negative);
 console.log("EXTERNAL_BIBLIOGRAPHY_BASELINE="+JSON.stringify({
    externalSource:"https://www.newadvent.org/fathers/",
    externalAuthors:20,indexListedPairs:ref.positive.length,
    explicitNegativeExamples:ref.negative.length,
    sameNameOverlapWithReviewedCatalog:nameOverlap.length,
    reviewedAuthorWorkTitleExactMatches:score.exactIndexMatches,
    exactCatalogTitleCoverage:score.indexCoverage,
    independentlyAdjudicated:false,
    liveAnswerBenchmarkRun:false,
    releaseReady:false,
 }));
 assert.equal(score.attributionReleaseReady,false);
});

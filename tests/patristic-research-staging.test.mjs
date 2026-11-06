import test from "node:test";
import assert from "node:assert/strict";
import {parseResearchArgs,research} from "../scripts/patristics/research-staging.mjs";

const entries=[
 {author:"St. Gregory of Nyssa",authorId:"gregory1",work:"On the Soul and the Resurrection",editionId:"g1",importStatus:"STAGED",passages:175,embedded:175,corpus:"CURATED_OTHER",sourceUrl:"https://www.newadvent.org/fathers/2915.htm"},
 {author:"St. Gregory of Nyssa",authorId:"gregory2",work:"On the Soul and the Resurrection",editionId:"g2",importStatus:"STAGED",passages:5,embedded:5,corpus:"CURATED_OTHER",sourceUrl:"https://example.org/source"},
 {author:"Augustine of Hippo",authorId:"augustine",work:"Confessiones",editionId:"a1",importStatus:"STAGED",passages:4,embedded:0,corpus:"PL",sourceUrl:"https://example.org/augustine"}
];
const mockCatalog=async()=>({editions:entries});

test("bibliography lists only known catalog titles, without inventing other works",async()=>{
 const r=await research(["--question","Која дела је написао Свети Григорије?","--author","St. Gregory of Nyssa"],{}, {catalog:mockCatalog});
 assert.equal(r.plan.intent,"BIBLIOGRAPHY");
 assert.equal(r.catalogRecords.length,2);
 assert.equal(r.textHits.length,0);
 assert.equal(r.status,"PARTIAL_CATALOG_ONLY");
});
test("an absent author does not silently return another father's passages",async()=>{
 let called=false;
 const r=await research(["--question","Шта Свети Максим учи о вољи?","--author","St. Maximus the Confessor"],{},{
   catalog:mockCatalog,
   evaluate:async()=>{called=true;throw Error("Should not execute");}
 });
 assert.equal(r.status,"NO_MATCHING_AUTHOR_IN_STAGING");
 assert.deepEqual(r.textHits,[]);
 assert.equal(called,false);
});
test("general question searches all staged authors",async()=>{
 const calls=[];
 const r=await research(["--question","What is resurrection?"],{},{
   catalog:mockCatalog,
   evaluate:async args=>{calls.push(args);return {hits:[{similarity:0.6,work:"On the Soul and the Resurrection"}]};}
 });
 assert.equal(r.status,"STAGING_EVIDENCE_FOUND");
 assert.equal(calls.length,1);
 assert.ok(!calls[0].includes("--author-id"));
});
test("duplicate author IDs are both searched with best results first",async()=>{
 const ids=[];
 const r=await research(["--question","What is resurrection?","--author","St. Gregory of Nyssa"],{},{
   catalog:mockCatalog,
   evaluate:async args=>{
     ids.push(args[args.indexOf("--author-id")+1]);
     return {hits:[{similarity:ids.length===1?0.3:0.7,work:"On the Soul and the Resurrection"}]};
   }
 });
 assert.deepEqual(ids,["gregory1","gregory2"]);
 assert.equal(r.textHits[0].similarity,0.7);
});
test("invalid command-line inputs fail before retrieval",()=>{
 assert.throws(()=>parseResearchArgs(["--question",""]),/Usage/);
 assert.throws(()=>parseResearchArgs(["--question","hello","--limit","0"]),/Usage/);
});

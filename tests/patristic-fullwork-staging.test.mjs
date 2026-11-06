import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stage} from "../scripts/patristics/stage-gregory-fullwork.mjs";

test("fullwork importer remains explicitly isolated from production",()=>{
  const script=readFileSync("scripts/patristics/stage-gregory-fullwork.mjs","utf8");
  assert.match(script,/LibraryStagingGuard/);
  assert.match(script,/PATRISTIC_LIBRARY_STAGING/);
  assert.match(script,/STAGED_UNREVIEWED/);
  assert.match(script,/3109b08a1a748037129cff95b199e11a06919d38cd0b932cdfd99ccdef2cdcdf/);
  assert.doesNotMatch(script,/api\/chat|PatristicQuote|prisma\.\$executeRaw/);
});
test("unconfigured and production-shaped imports fail before fetching text or accessing DB",async()=>{
  let touched=false;
  const fetchDocument=async()=>{touched=true;throw Error("should not fetch")};
  await assert.rejects(stage([],{}, {fetchDocument}),/Missing staging/);
  assert.equal(touched,false);
  await assert.rejects(stage([],{
    LIBRARY_STAGING_DB_URL:"postgresql://owner:secret@evil.example/test",
    LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6"
  },{fetchDocument}),/Invalid staging DB configuration/);
  assert.equal(touched,false);
});
test("unexpected arguments fail safely",async()=>{
  await assert.rejects(stage(["--production"],{},{}),/No arguments permitted/);
});

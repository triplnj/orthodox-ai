import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {auditStagingTranscriptions} from "../scripts/patristics/audit-staging-transcriptions.mjs";
const env={LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6",
 LIBRARY_STAGING_DB_URL:"postgresql://fixture:fixture@ep-fixture.eu-central-1.aws.neon.tech/neondb"};
const content="The Word appeared in a human body for our salvation and offered Himself to restore human nature and defeat death.";
const hash=createHash("sha256").update(content,"utf8").digest("hex");
const rows=[{editionId:"e1",sourceUrl:"https://www.newadvent.org/fathers/example.htm",
 editionTitle:"Source",passageId:"p1",locator:"Paragraph 1",content,storedHash:hash,computedHash:hash},
 {editionId:"e1",sourceUrl:"https://www.newadvent.org/fathers/example.htm",
 editionTitle:"Source",passageId:"p2",locator:"Page title",content:"Short",storedHash:"hash",computedHash:"hash"}];
function setup(guard=[{branchId:"br-spring-frost-assfzje6",purpose:"PATRISTIC_LIBRARY_STAGING"}]){
 const statements=[];let closed=false;let networkCalls=0;
 return {statements,get closed(){return closed},get networkCalls(){return networkCalls},
  db:{connect:async()=>{},end:async()=>{closed=true},query:async sql=>{statements.push(sql);
   return {rows:sql.includes("LibraryStagingGuard")?guard:rows};}},
  fetch:async()=>{networkCalls++;return {ok:true,text:async()=>"<html><body><article>"+content+"</article></body></html>"}}};
}
test("source audit uses real passage hash, two read-only SQL calls, one page per edition URL",async()=>{
 const fx=setup();
 const r=await auditStagingTranscriptions(env,{db:fx.db,fetch:fx.fetch});
 assert.equal(r.total,2);
 assert.equal(r.stats.FULL_NORMALIZED_MATCH,1);
 assert.equal(r.stats.TOO_SHORT_FOR_TEXT_AUDIT,1);
 assert.equal(r.badHashes,0);
 assert.equal(fx.networkCalls,1);
 assert.equal(fx.statements.length,2);
 assert.ok(fx.statements.every(s=>s.trim().startsWith("SELECT")));
 assert.equal(fx.closed,true);
});
test("guard mismatch fails closed before reading passages",async()=>{
 const fx=setup([]);
 await assert.rejects(()=>auditStagingTranscriptions(env,{db:fx.db,fetch:fx.fetch}),/guard mismatch/i);
 assert.equal(fx.statements.length,1);
 assert.equal(fx.networkCalls,0);
 assert.equal(fx.closed,true);
});
test("wrong branch and non-Neon URL rejected before connecting",async()=>{
 const fx=setup();
 await assert.rejects(()=>auditStagingTranscriptions({...env,LIBRARY_STAGING_BRANCH_ID:"production"},{db:fx.db}),/Protected staging/);
 await assert.rejects(()=>auditStagingTranscriptions({...env,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/main"},{db:fx.db}),/Invalid Neon/);
 assert.equal(fx.statements.length,0);
});

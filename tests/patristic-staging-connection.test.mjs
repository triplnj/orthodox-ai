import test from "node:test";
import assert from "node:assert/strict";
import {checkStagingConnection} from "../scripts/patristics/check-staging-connection.mjs";

const valid={
 LIBRARY_STAGING_DB_URL:"postgresql://test:password@ep-test.eu-central-1.aws.neon.tech/neondb",
 LIBRARY_STAGING_BRANCH_ID:"br-spring-frost-assfzje6"
};
function dbWithGuard(branch=valid.LIBRARY_STAGING_BRANCH_ID){
 const queries=[];
 const db={
   async connect(){},
   async end(){},
   async query(sql){
     queries.push(sql);
     if(sql.includes('"LibraryStagingGuard"'))
       return {rows:[{branchId:branch,purpose:"PATRISTIC_LIBRARY_STAGING"}]};
     if(sql.includes('count(DISTINCT'))return {rows:[{authors:2,works:2,editions:3,passages:184}]};
     throw Error("Unexpected SQL");
   }
 };
 return {db,queries};
}
test("checks only staging and performs no mutations",async()=>{
 const {db,queries}=dbWithGuard();
 const result=await checkStagingConnection(valid,{db});
 assert.equal(result.status,"STAGING_CONNECTION_VERIFIED");
 assert.equal(result.counts.passages,184);
 assert.equal(result.databaseWrites,0);
 assert.ok(queries.every(q=>/^\s*SELECT\s/i.test(q)));
});
test("fails closed when configured branch differs from database guard",async()=>{
 const {db,queries}=dbWithGuard("br-incorrect");
 await assert.rejects(checkStagingConnection(valid,{db}),/guard failed/);
 assert.equal(queries.length,1);
});
test("does not accept missing secrets or a non-Neon host",async()=>{
 await assert.rejects(checkStagingConnection({},{}),/Missing/);
 await assert.rejects(checkStagingConnection({...valid,LIBRARY_STAGING_DB_URL:"postgresql://x:y@localhost/db"}),/Invalid/);
});

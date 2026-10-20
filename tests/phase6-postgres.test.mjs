import assert from "node:assert/strict";
import fs from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// No connection string, existing database or migration runner is used. Build a
// disposable in-memory fixture, then install the exact proposed SQL contract
// clauses (indexes/checks/triggers), not the additive application migration.
let db; let sequence = 0;
before(async () => {
  db = new PGlite(); await db.waitReady;
  await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE "AiReservation" (
      id TEXT PRIMARY KEY, subject TEXT NOT NULL, feature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RUNNING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '5 minutes', "finishedAt" TIMESTAMP(3),
      "userId" TEXT, "requestKey" VARCHAR(128), "requestHash" CHAR(64), "responseSnapshot" JSONB);
    CREATE TABLE journal(id TEXT PRIMARY KEY, "userId" TEXT REFERENCES users(id) ON DELETE CASCADE, summary TEXT);`);
  const sql = fs.readFileSync("prisma/migrations/20261020000000_api_quota_integrity/migration.sql", "utf8");
  await db.exec(sql.slice(sql.indexOf("CREATE UNIQUE INDEX"), sql.lastIndexOf("COMMIT;")));
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec(`SET TIME ZONE 'UTC'; TRUNCATE "AiReservation", journal, users CASCADE; INSERT INTO users VALUES ('alice'),('bob');`); });
async function seed(overrides = {}) {
  const row = { id: `r${++sequence}`, subject: "alice", feature: "prayer-plan", userId: "alice", requestKey: `key${sequence}`, requestHash: "a".repeat(64), status: "RUNNING", snapshot: null, finished: null, ...overrides };
  await db.query(`INSERT INTO "AiReservation" (id,subject,feature,"userId","requestKey","requestHash",status,"responseSnapshot","finishedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [row.id,row.subject,row.feature,row.userId,row.requestKey,row.requestHash,row.status,row.snapshot === null ? null : JSON.stringify(row.snapshot),row.finished]); return row;
}
const complete = (id, age = "0 seconds") => db.query(`UPDATE "AiReservation" SET status='COMPLETED',"finishedAt"=CURRENT_TIMESTAMP - $2::interval,"responseSnapshot"='{"plan":"private"}' WHERE id=$1 AND status='RUNNING' RETURNING id`,[id,age]);
test("legacy NULL-key rows need no backfill and remain writable", async () => {
  await seed({ userId: null, requestKey: null, requestHash: null }); await seed({ userId: null, requestKey: null, requestHash: null });
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM "AiReservation"`)).rows[0].n,2);
});
for(const feature of ["prayer-plan","fasting-plan","scripture-plan","journal-summary"]) test(`valid lifecycle ${feature}`, async () => {
  const row=await seed({feature}); await db.query(`UPDATE "AiReservation" SET "expiresAt"=CURRENT_TIMESTAMP+INTERVAL '5 minutes' WHERE id=$1`,[row.id]);
  assert.equal((await complete(row.id)).rows.length,1);
});
for(const values of [{requestKey:null},{requestHash:null},{requestHash:"bad"},{requestKey:"../bad"},{userId:null},{userId:"bob"},{feature:"chat"}]) test(`identity constraint rejects ${JSON.stringify(values)}`, async () => {
  await assert.rejects(seed(values), error => error.code === "23514");
});
test("foreign owner is rejected by PostgreSQL", async () => { await assert.rejects(seed({userId:"missing",subject:"missing"}),error=>error.code==="23503"); });
test("concurrent duplicate inserts have exactly one database winner", async () => {
  const results=await Promise.allSettled(Array.from({length:12},()=>seed({requestKey:"duplicate"})));
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
  assert.ok(results.filter(result=>result.status==="rejected").every(result=>result.reason.code==="23505"));
});
test("same request key is separately scoped by feature and owner", async () => {
  await seed({requestKey:"same"}); await seed({requestKey:"same",feature:"fasting-plan"}); await seed({requestKey:"same",userId:"bob",subject:"bob"});
});
test("completed request cannot have a missing/non-object/oversized snapshot", async () => {
  const row=await seed(); for(const payload of [null,"text",{plan:"x".repeat(270000)}]) {
    await assert.rejects(db.query(`UPDATE "AiReservation" SET status='COMPLETED',"finishedAt"=CURRENT_TIMESTAMP,"responseSnapshot"=$2::jsonb WHERE id=$1`,[row.id,payload===null?null:JSON.stringify(payload)]),error=>error.code==="23514");
  }
});
test("failed/running reservations cannot contain cached private responses", async () => {
  await assert.rejects(seed({snapshot:{plan:"private"}}),error=>error.code==="23514");
});
test("terminal status requires a finish time", async () => { await assert.rejects(seed({status:"FAILED"}),error=>error.code==="23514"); });
test("running status cannot pretend to be finished", async () => { await assert.rejects(seed({finished:new Date().toISOString()}),error=>error.code==="23514"); });
for(const status of ["COMPLETED","FAILED","ABANDONED","RESULT_EXPIRED"]) test(`terminal ${status} cannot restart`, async () => {
  const row=await seed(); if(status==="COMPLETED")await complete(row.id);
  else if(status==="RESULT_EXPIRED") { await complete(row.id,"8 days"); await db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"responseSnapshot"=NULL WHERE id=$1`,[row.id]); }
  else await db.query(`UPDATE "AiReservation" SET status=$2,"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1`,[row.id,status]);
  await assert.rejects(db.query(`UPDATE "AiReservation" SET status='RUNNING',"finishedAt"=NULL,"responseSnapshot"=NULL WHERE id=$1`,[row.id]),error=>error.code==="P0001");
});
test("identity and charged timestamp cannot change during execution", async () => {
  const row=await seed(); for(const fragment of [`"requestKey"='different'`,`"requestHash"=repeat('b',64)`,`"createdAt"=CURRENT_TIMESTAMP-INTERVAL '1 day'`,`subject='bob'`]) {
    await assert.rejects(db.query(`UPDATE "AiReservation" SET ${fragment} WHERE id=$1`,[row.id]),error=>error.code==="P0001");
  }
});
test("recovery fences stale completion while allowing only capacity lease renewal", async () => {
  const row=await seed(); await db.query(`UPDATE "AiReservation" SET status='ABANDONED',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1`,[row.id]);
  assert.equal((await complete(row.id)).rows.length,0);
  await db.query(`UPDATE "AiReservation" SET "expiresAt"=CURRENT_TIMESTAMP+INTERVAL '5 minutes' WHERE id=$1`,[row.id]);
  await assert.rejects(db.query(`UPDATE "AiReservation" SET "responseSnapshot"='{}' WHERE id=$1`,[row.id]),error=>error.code==="P0001");
});
test("completed cache cannot be rewritten or erased before retention", async () => {
  const row=await seed();await complete(row.id);
  await assert.rejects(db.query(`UPDATE "AiReservation" SET "responseSnapshot"='{"plan":"changed"}' WHERE id=$1`,[row.id]),error=>error.code==="P0001");
  await assert.rejects(db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"responseSnapshot"=NULL WHERE id=$1`,[row.id]),error=>error.code==="P0001");
});
test("seven-day erasure preserves request identity, timestamps and charged row", async () => {
  const row=await seed();await complete(row.id,"8 days");
  const before=(await db.query(`SELECT * FROM "AiReservation" WHERE id=$1`,[row.id])).rows[0];
  await db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"responseSnapshot"=NULL WHERE id=$1`,[row.id]);
  const after=(await db.query(`SELECT * FROM "AiReservation" WHERE id=$1`,[row.id])).rows[0];
  for(const key of ["id","requestKey","requestHash","createdAt","finishedAt","expiresAt"])assert.deepEqual(after[key],before[key]);
  assert.equal(after.responseSnapshot,null);assert.equal(after.status,"RESULT_EXPIRED");
  await assert.rejects(seed({requestKey:row.requestKey}),error=>error.code==="23505");
});
test("retention exception cannot modify other fields", async () => {
  const row=await seed();await complete(row.id,"8 days");
  await assert.rejects(db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"responseSnapshot"=NULL,"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1`,[row.id]),error=>error.code==="P0001");
});
test("running requests cannot skip directly to expired", async () => {
  const row=await seed(); await assert.rejects(db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1`,[row.id]),error=>error.code==="P0001");
});
test("journal write and completion roll back together", async () => {
  const row=await seed({feature:"journal-summary"}); await db.exec(`INSERT INTO journal VALUES ('entry','alice',NULL)`);
  await db.exec("BEGIN"); await db.query(`UPDATE journal SET summary='answer' WHERE id='entry'`); await complete(row.id); await db.exec("ROLLBACK");
  assert.equal((await db.query(`SELECT summary FROM journal`)).rows[0].summary,null);assert.equal((await db.query(`SELECT status FROM "AiReservation"`)).rows[0].status,"RUNNING");
});
test("user deletion removes all linked lifecycle states but preserves other users and legacy rows", async () => {
  for(const status of ["RUNNING","COMPLETED","FAILED","ABANDONED","RESULT_EXPIRED"]) {
    await seed({status,finished:status==="RUNNING"?null:new Date().toISOString(),snapshot:status==="COMPLETED"?{plan:"private"}:null});
  }
  await seed({userId:"bob",subject:"bob"});await seed({userId:null,requestKey:null,requestHash:null});
  await db.query(`DELETE FROM users WHERE id='alice'`);
  const rows=(await db.query(`SELECT "userId","responseSnapshot" FROM "AiReservation"`)).rows;
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.userId!=="alice"));assert.ok(rows.every(row=>row.responseSnapshot===null));
});
const states = ["RUNNING","COMPLETED","FAILED","ABANDONED","RESULT_EXPIRED"];
for (const from of states) for (const to of states) test(`PostgreSQL lifecycle transition ${from} -> ${to}`, async () => {
  const row = await seed({ status: from, finished: from === "RUNNING" ? null : new Date(Date.now()-8*86400000).toISOString(), snapshot: from === "COMPLETED" ? {plan:"private"} : null });
  const work = () => db.query(`UPDATE "AiReservation" SET status=$2,
    "responseSnapshot"=CASE WHEN $2='COMPLETED' THEN '{"plan":"private"}'::jsonb ELSE NULL END,
    "finishedAt"=CASE WHEN $2='RUNNING' THEN NULL ELSE COALESCE("finishedAt",CURRENT_TIMESTAMP) END WHERE id=$1`,[row.id,to]);
  const allowed = from===to || (from==="RUNNING" && to!=="RESULT_EXPIRED") || (from==="COMPLETED" && to==="RESULT_EXPIRED");
  if(allowed) await work(); else await assert.rejects(work(),error=>error.code==="P0001");
});
test("retention age is UTC-based regardless of PostgreSQL session timezone",async()=>{
  const row=await seed();await complete(row.id,"7 days 30 minutes");
  await db.exec(`SET TIME ZONE 'Pacific/Honolulu'`);
  await db.query(`UPDATE "AiReservation" SET status='RESULT_EXPIRED',"responseSnapshot"=NULL WHERE id=$1`,[row.id]);
  assert.equal((await db.query(`SELECT status FROM "AiReservation" WHERE id=$1`,[row.id])).rows[0].status,"RESULT_EXPIRED");
});

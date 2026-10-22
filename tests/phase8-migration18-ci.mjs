import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Deliberately not a production migrator. Refuse anything except the dedicated
// ephemeral CI database and never read DATABASE_URL / DIRECT_URL.
if (process.env.CI !== "true" ||
    process.env.PGHOST !== "127.0.0.1" ||
    process.env.PGPORT !== "55439" ||
    process.env.PGDATABASE !== "orthodoxai_synthetic" ||
    process.env.PGUSER !== "orthodoxai_ci" ||
    process.env.PGPASSWORD !== "synthetic-ci-only") {
  throw new Error("Refusing to run outside the isolated synthetic CI database");
}
const client = new pg.Client({
  host: "127.0.0.1", port: 55439, database: "orthodoxai_synthetic",
  user: "orthodoxai_ci", password: "synthetic-ci-only", ssl: false,
});
const schema = "synthetic_" + randomUUID().replaceAll("-", "");
const migration = readFileSync("prisma/migrations/20261021000000_bounded_legacy_reconciliation/migration.sql", "utf8");
await client.connect();
try {
  const identity = (await client.query("SELECT current_database() db, current_user usr, inet_server_addr()::text addr, inet_server_port() port")).rows[0];
  assert.equal(identity.db, "orthodoxai_synthetic");
  assert.equal(identity.usr, "orthodoxai_ci");
  // GitHub-hosted Docker publishes loopback:55439 to container:5432.
  // inet_server_addr() reports the container interface, not the host endpoint.
  assert.match(identity.addr, /^(?:127\.0\.0\.1|172\.(?:1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3})(?:\/32)?$/);
  assert.equal(identity.port, 5432);
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`CREATE TABLE "users" (
    id TEXT PRIMARY KEY, plan TEXT NOT NULL, "subscriptionStatus" TEXT,
    "billingAccessUntil" TIMESTAMP(3)
  )`);
  await client.query(`INSERT INTO "users" (id,plan,"subscriptionStatus","billingAccessUntil") VALUES
    ('eligible1','PRO','active',NULL),
    ('eligible2','PRO','active',NULL),
    ('free','FREE',NULL,NULL),
    ('inactive','PRO','inactive',NULL),
    ('finite','PRO','active',TIMESTAMP '2030-01-01 00:00:00')`);
  await client.query(migration);
  const rows = (await client.query('SELECT id, "legacyReconciliationDeadlineAt" deadline, plan, "subscriptionStatus" status FROM "users" ORDER BY id')).rows;
  const eligible = rows.filter(row => row.id.startsWith("eligible"));
  assert.equal(eligible.length, 2);
  assert.ok(eligible[0].deadline instanceof Date);
  assert.equal(eligible[0].deadline.getTime(), eligible[1].deadline.getTime());
  const remaining = rows.filter(row => !row.id.startsWith("eligible"));
  assert.ok(remaining.every(row => row.deadline === null));
  const delta = eligible[0].deadline.getTime() - Date.now();
  assert.ok(delta > 71.5 * 60 * 60 * 1000 && delta <= 72 * 60 * 60 * 1000 + 30000, "Deadline must be cutover + 72h");
  async function expectRejected(sql, values = []) {
    await client.query("SAVEPOINT negative_case");
    let rejected = false;
    try { await client.query(sql, values); }
    catch (error) { rejected = true; assert.equal(error.code, "23514"); }
    finally { await client.query("ROLLBACK TO SAVEPOINT negative_case"); await client.query("RELEASE SAVEPOINT negative_case"); }
    assert.equal(rejected, true, "Expected immutable marker trigger rejection");
  }
  await client.query("BEGIN");
  try {
    await expectRejected('INSERT INTO "users" (id,plan,"legacyReconciliationDeadlineAt") VALUES ($1,$2,$3)', ["injected", "PRO", eligible[0].deadline]);
    await expectRejected('UPDATE "users" SET "legacyReconciliationDeadlineAt" = NULL WHERE id=$1', ["eligible1"]);
    await expectRejected('UPDATE "users" SET "legacyReconciliationDeadlineAt" = "legacyReconciliationDeadlineAt" + INTERVAL \'1 hour\' WHERE id=$1', ["eligible1"]);
    await expectRejected('UPDATE "users" SET "legacyReconciliationDeadlineAt" = $1 WHERE id=$2', [eligible[0].deadline, "free"]);
    await client.query('UPDATE "users" SET "plan"=$1 WHERE id=$2', ["FREE", "eligible1"]);
    await client.query('INSERT INTO "users" (id,plan) VALUES ($1,$2)', ["newfree", "FREE"]);
    const persisted = (await client.query('SELECT "legacyReconciliationDeadlineAt" deadline FROM "users" WHERE id=$1', ["eligible1"])).rows[0];
    assert.equal(persisted.deadline.getTime(), eligible[0].deadline.getTime());
    await client.query("ROLLBACK");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  console.log("MIGRATION_18_SYNTHETIC_PASS: backfill, UTC deadline, single cutover, immutability, safe updates");
} finally {
  try { await client.query("RESET search_path"); await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
  finally { await client.end(); }
}

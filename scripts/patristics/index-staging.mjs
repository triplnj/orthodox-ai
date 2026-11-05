/**
 * One-shot, deliberately manual staging embedding job.
 * NEVER invoked by Vercel or the live chat route.
 * Requires an isolated Neon connection, an expected branch marker and an API key.
 *
 * Usage:
 * LIBRARY_STAGING_DB_URL=... LIBRARY_STAGING_BRANCH_ID=br-... OPENAI_API_KEY=...
 * node scripts/patristics/index-staging.mjs --edition <id> [--batch 8]
 */
import pg from "pg";
import OpenAI from "openai";
import { pathToFileURL } from "node:url";

const { Client } = pg;
const MODEL = "text-embedding-3-small";
const STAGING_PURPOSE = "PATRISTIC_LIBRARY_STAGING";

function parseArgs(argv) {
  const index = argv.indexOf("--edition");
  const edition = index >= 0 ? argv[index + 1] : "";
  const batchIndex = argv.indexOf("--batch");
  const batch = batchIndex < 0 ? 8 : Number(argv[batchIndex + 1]);
  if (!/^edition_[a-f0-9]{32}$/.test(edition) ||
      !Number.isInteger(batch) || batch < 1 || batch > 20) {
    throw new Error("Usage: --edition edition_<32 hex chars> [--batch 1..20]");
  }
  return { edition, batch };
}

function getConfig(env) {
  const url = env.LIBRARY_STAGING_DB_URL;
  const branchId = env.LIBRARY_STAGING_BRANCH_ID;
  if (!url || !branchId || !env.OPENAI_API_KEY) {
    throw new Error("Required: LIBRARY_STAGING_DB_URL, LIBRARY_STAGING_BRANCH_ID and OPENAI_API_KEY");
  }
  if (!/^br-[a-z0-9-]+$/.test(branchId)) throw new Error("Invalid staging branch ID");
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !/\.neon\.tech$/i.test(parsed.hostname) ||
      !parsed.username || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("Staging connection must be a Neon Postgres database URL");
  }
  return { url, branchId, apiKey: env.OPENAI_API_KEY };
}

async function assertStaging(client, branchId) {
  // Missing table on production = fail closed. The marker is installed only on
  // the isolated staging branch by the operator using Neon branch-scoped SQL.
  const { rows } = await client.query(
    'SELECT "branchId","purpose" FROM "LibraryStagingGuard"',
  );
  if (rows.length !== 1 || rows[0].branchId !== branchId ||
      rows[0].purpose !== STAGING_PURPOSE) {
    throw new Error("Database is not the expressly approved staging branch");
  }
}

function validateEmbedding(values) {
  if (!Array.isArray(values) || values.length !== 1536 ||
      values.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("Embedding dimension mismatch: expected 1536 finite values");
  }
}

export async function main(argv = process.argv.slice(2), env = process.env, dependencies = {}) {
  const { edition, batch } = parseArgs(argv);
  const { url, branchId, apiKey } = getConfig(env);
  const db = dependencies.db ?? new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
  const embeddingClient = dependencies.ai ?? new OpenAI({ apiKey });
  await db.connect();
  try {
    await assertStaging(db, branchId);
    const { rows: editionRows } = await db.query(
      'SELECT "importStatus" FROM "LibraryEdition" WHERE "id"=$1',
      [edition],
    );
    if (editionRows.length !== 1 || editionRows[0].importStatus !== "STAGED") {
      throw new Error("Edition must exist and remain STAGED");
    }
    const { rows } = await db.query(
      'SELECT "id","content" FROM "LibraryPassage" WHERE "editionId"=$1 ' +
      'AND "embedding" IS NULL ORDER BY "locator","ordinal" LIMIT $2',
      [edition, batch],
    );
    if (!rows.length) return { indexed: 0, remaining: 0 };
    const response = await embeddingClient.embeddings.create({
      model: MODEL, input: rows.map(r => r.content), encoding_format: "float",
    });
    const data = [...response.data].sort((a, b) => a.index - b.index);
    if (data.length !== rows.length ||
        data.some((item, i) => item.index !== i)) {
      throw new Error("OpenAI embeddings response did not match input passages");
    }
    data.forEach(item => validateEmbedding(item.embedding));
    await assertStaging(db, branchId); // fail before any writes if branch guard changed
    await db.query("BEGIN");
    try {
      for (let i = 0; i < rows.length; i++) {
        const { rowCount } = await db.query(
          'UPDATE "LibraryPassage" p SET "embedding"=$1::vector ' +
          'FROM "LibraryEdition" e WHERE p."id"=$2 AND p."editionId"=e."id" ' +
          'AND e."id"=$3 AND e."importStatus"=\'STAGED\' AND p."embedding" IS NULL',
          ["[" + data[i].embedding.join(",") + "]", rows[i].id, edition],
        );
        if (rowCount !== 1) throw new Error("Concurrent change: staging transaction rolled back");
      }
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    const remaining = await db.query(
      'SELECT count(*)::integer AS count FROM "LibraryPassage" WHERE "editionId"=$1 AND "embedding" IS NULL',
      [edition],
    );
    return { indexed: rows.length, remaining: Number(remaining.rows[0].count) };
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(result => { process.stdout.write(JSON.stringify(result) + "\n"); })
    .catch(error => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
}

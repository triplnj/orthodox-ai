/**
 * Read-only scan of the 175 Gregory source passages on an isolated staging Neon branch.
 * Flags candidate dialogue changes for human review without writing annotations.
 *
 * Usage: node scripts/patristics/scan-dialogue-staging.mjs
 */
import pg from "pg";
import { pathToFileURL } from "node:url";
import { detectBoundaryCandidates } from "./flag-dialogue-boundaries.mjs";

const { Client } = pg;
const EDITION = "edition_7f982e9d2f0acc26526b91f0042dee75";

export async function scan(env = process.env, deps = {}) {
  const connectionString = env.LIBRARY_STAGING_DB_URL;
  const branch = env.LIBRARY_STAGING_BRANCH_ID;
  if (!connectionString || !branch) throw new Error("Staging URL and branch ID are required");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !/\.neon\.tech$/i.test(url.hostname) ||
      !url.username || !/^br-[a-z0-9-]+$/.test(branch)) {
    throw new Error("Invalid Neon staging configuration");
  }

  const db = deps.db ?? new Client({ connectionString, ssl: { rejectUnauthorized: true } });
  await db.connect();
  try {
    const guard = await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
    if (guard.rows.length !== 1 || guard.rows[0].branchId !== branch ||
        guard.rows[0].purpose !== "PATRISTIC_LIBRARY_STAGING") {
      throw new Error("Refusing to scan a non-staging database");
    }

    const edition = await db.query(
      'SELECT "importStatus" FROM "LibraryEdition" WHERE "id"=$1',
      [EDITION]
    );
    if (edition.rows.length !== 1 || edition.rows[0].importStatus !== "STAGED") {
      throw new Error("Expected the specified STAGED Gregory edition");
    }

    const result = await db.query(
      'SELECT "locator","ordinal","content" FROM "LibraryPassage" ' +
      'WHERE "editionId"=$1 ORDER BY "locator","ordinal"',
      [EDITION]
    );
    const chunks = result.rows;
    if (chunks.length !== 175) throw new Error("Expected precisely 175 indexed source passages");
    const candidates = detectBoundaryCandidates(chunks);
    const counts = {};
    for (const c of candidates) {
      for (const flag of c.flags) counts[flag.marker] = (counts[flag.marker] ?? 0) + 1;
    }

    const reviewAll = deps.reviewAll === true;
    const byKey = new Map(chunks.map((c,i) => [`${c.locator}:${c.ordinal}`, {chunk:c,index:i}]));
    const reviewEntries = candidates.map(c => {
      const entry = byKey.get(`${c.locator}:${c.ordinal}`);
      return {
        locator:c.locator,
        ordinal:c.ordinal,
        status:"CANDIDATE_ONLY",
        flags:c.flags.map(f => ({
          marker:f.marker, offset:f.offset, evidenceText:f.evidenceText,
          speaker:"UNDETERMINED", requiresHumanReview:true,
          contextBefore:entry.chunk.content.slice(Math.max(0,f.offset-180), f.offset),
          contextAfter:entry.chunk.content.slice(f.offset+f.evidenceText.length, f.offset+f.evidenceText.length+180)
        })),
        previousChunkEnd:chunks[entry.index-1]?.content.slice(-180) ?? null,
        nextChunkStart:chunks[entry.index+1]?.content.slice(0,180) ?? null
      };
    });
    return {
      editionId: EDITION,
      status: "READ_ONLY_CANDIDATES",
      scannedPassages: chunks.length,
      flaggedPassages: candidates.length,
      unflaggedPassages: chunks.length - candidates.length,
      flagCounts: counts,
      reviewSamples: reviewAll ? reviewEntries : candidates.slice(0, 15),
      limitation: "Lexical markers are incomplete and can appear inside quoted speech. Neither flagged nor unflagged passages establish a verified speaker.",
      databaseWrites: 0
    };
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scan(process.env, {reviewAll: process.argv.includes("--review-all")}).then(output => process.stdout.write(JSON.stringify(output, null, 2) + "\n"))
    .catch(error => { process.stderr.write("SCAN_FAILED: " + error.message + "\n"); process.exitCode = 1; });
}

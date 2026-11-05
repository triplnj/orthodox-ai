/**
 * Dependency-injected, transaction-bound staging writer.
 * No connection creation, no environment variable parsing, no chat imports.
 * Caller MUST supply a client connected to an isolated staging branch.
 */
import type { LibraryImportPlan } from "./prepare-import";

export type SqlClient = {
  query(sql: string, params?: unknown[]): Promise<{ rowCount?: number | null; rows?: unknown[] }>;
};

function requirePlan(plan: LibraryImportPlan): void {
  if (plan.edition.importStatus !== "STAGED" ||
      !plan.author.id || !plan.work.id || !plan.edition.id ||
      plan.passages.length === 0 ||
      plan.passages.some(p => p.editionId !== plan.edition.id ||
        !/^[a-f0-9]{64}$/.test(p.contentSha256))) {
    throw new Error("Only validated STAGED import plans are allowed");
  }
}

/**
 * Idempotent inserts: does not update or overwrite an already reviewed source.
 * A mismatched existing record raises instead of silently diverging.
 */
export async function stageLibraryImport(
  client: SqlClient,
  plan: LibraryImportPlan,
): Promise<{ passages: number }> {
  requirePlan(plan);
  await client.query("BEGIN");
  try {
    const a = plan.author;
    await client.query(
      'INSERT INTO "LibraryAuthor" ("id", "canonicalName") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING',
      [a.id, a.canonicalName],
    );
    const w = plan.work;
    await client.query(
      'INSERT INTO "LibraryWork" ("id", "authorId", "title") VALUES ($1, $2, $3) ON CONFLICT ("id") DO NOTHING',
      [w.id, w.authorId, w.title],
    );
    const e = plan.edition;
    await client.query(
      'INSERT INTO "LibraryEdition" ("id", "workId", "corpus", "editionTitle", "originalLanguage", "sourceUrl", "licenseNote", "importStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("id") DO NOTHING',
      [e.id, e.workId, e.corpus, e.editionTitle, e.originalLanguage, e.sourceUrl, e.licenseNote, "STAGED"],
    );
    for (const p of plan.passages) {
      await client.query(
        'INSERT INTO "LibraryPassage" ("id","editionId","locator","ordinal","content","contentSha256","language","ocrQuality") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("id") DO NOTHING',
        [p.id,p.editionId,p.locator,p.ordinal,p.content,p.contentSha256,p.language,"UNREVIEWED"],
      );
    }
    const checked = await client.query(
      'SELECT count(*)::integer AS total FROM "LibraryPassage" WHERE "editionId"=$1 AND "locator"=$2',
      [e.id, plan.passages[0].locator],
    );
    const actual = Number((checked.rows?.[0] as { total?: number } | undefined)?.total);
    if (actual !== plan.passages.length) {
      throw new Error("Passage count mismatch; edition import was rolled back");
    }
    const recorded = await client.query(
      'SELECT "ordinal","contentSha256" FROM "LibraryPassage" WHERE "editionId"=$1 AND "locator"=$2 ORDER BY "ordinal"',
      [e.id, plan.passages[0].locator],
    );
    if (!recorded.rows || recorded.rows.length !== plan.passages.length ||
        recorded.rows.some((row, index) => {
          const item = row as { ordinal: number; contentSha256: string };
          return item.ordinal !== index || item.contentSha256 !== plan.passages[index].contentSha256;
        })) {
      throw new Error("Existing staged text differs from import; no overwrite permitted");
    }
    await client.query("COMMIT");
    return { passages: plan.passages.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

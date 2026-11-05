/**
 * Transactional staging-only ingestion of a complete work, preserving
 * section locators. Never activates material and never modifies live tables.
 * Supply a SQL client connected to a separate staging branch.
 */
import type { SqlClient } from "./stage-import";
import type { WorkImportPlan } from "./prepare-work-import";

export async function stageLibraryWorkImport(
  db: SqlClient,
  plan: WorkImportPlan,
): Promise<{ sections: number; passages: number }> {
  if (plan.edition.importStatus !== "STAGED" || !plan.sectionCount ||
      !plan.passages.length || plan.passages.length > 2500 ||
      plan.passages.some(p => p.editionId !== plan.edition.id ||
        !/^[a-f0-9]{64}$/.test(p.contentSha256))) {
    throw new Error("Only bounded, validated STAGED work imports are permitted");
  }
  const expected = new Map<string, string>();
  const sectionLocators = new Set<string>();
  for (const p of plan.passages) {
    const key = JSON.stringify([p.locator, p.ordinal]);
    if (expected.has(key)) throw new Error("Duplicate locator / ordinal");
    expected.set(key, p.contentSha256);
    sectionLocators.add(p.locator);
  }
  if (sectionLocators.size !== plan.sectionCount) throw new Error("Section count mismatch");

  await db.query("BEGIN");
  try {
    await db.query(
      'INSERT INTO "LibraryAuthor" ("id","canonicalName") VALUES ($1,$2) ON CONFLICT ("id") DO NOTHING',
      [plan.author.id, plan.author.canonicalName],
    );
    await db.query(
      'INSERT INTO "LibraryWork" ("id","authorId","title") VALUES ($1,$2,$3) ON CONFLICT ("id") DO NOTHING',
      [plan.work.id, plan.work.authorId, plan.work.title],
    );
    const e = plan.edition;
    await db.query(
      'INSERT INTO "LibraryEdition" ("id","workId","corpus","editionTitle","originalLanguage","sourceUrl","licenseNote","importStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,\'STAGED\') ON CONFLICT ("id") DO NOTHING',
      [e.id,e.workId,e.corpus,e.editionTitle,e.originalLanguage,e.sourceUrl,e.licenseNote],
    );

    // Catch id collisions / edition metadata changes before writing passages.
    const edition = await db.query(
      'SELECT e."workId",e."corpus",e."editionTitle",e."originalLanguage",e."sourceUrl",e."licenseNote",e."importStatus",w."title",w."authorId",a."canonicalName" ' +
      'FROM "LibraryEdition" e JOIN "LibraryWork" w ON w."id"=e."workId" JOIN "LibraryAuthor" a ON a."id"=w."authorId" WHERE e."id"=$1',
      [e.id],
    );
    const stored = edition.rows?.[0] as Record<string, string> | undefined;
    if (!stored || stored.workId !== e.workId || stored.corpus !== e.corpus ||
        stored.editionTitle !== e.editionTitle ||
        stored.originalLanguage !== e.originalLanguage ||
        stored.sourceUrl !== e.sourceUrl ||
        stored.licenseNote !== e.licenseNote ||
        stored.importStatus !== "STAGED" ||
        stored.title !== plan.work.title ||
        stored.authorId !== plan.author.id ||
        stored.canonicalName !== plan.author.canonicalName) {
      throw new Error("Edition metadata mismatch or an edition is no longer STAGED");
    }

    for (const p of plan.passages) {
      await db.query(
        'INSERT INTO "LibraryPassage" ("id","editionId","locator","ordinal","content","contentSha256","language","ocrQuality") VALUES ($1,$2,$3,$4,$5,$6,$7,\'UNREVIEWED\') ON CONFLICT ("id") DO NOTHING',
        [p.id,p.editionId,p.locator,p.ordinal,p.content,p.contentSha256,p.language],
      );
    }

    const observed = await db.query(
      'SELECT p."locator",p."ordinal",p."contentSha256",p."language" FROM "LibraryPassage" p ' +
      'WHERE p."editionId"=$1 AND p."locator"=ANY($2::text[])',
      [e.id,[...sectionLocators]],
    );
    if (!observed.rows || observed.rows.length !== plan.passages.length) {
      throw new Error("Imported passage count differs from expected; rolled back");
    }
    for (const row of observed.rows as Array<{locator:string;ordinal:number;contentSha256:string;language:string}>) {
      const expectedHash = expected.get(JSON.stringify([row.locator,row.ordinal]));
      if (!expectedHash || expectedHash !== row.contentSha256 || row.language !== e.originalLanguage) {
        throw new Error("Existing passage differs from source; rolled back");
      }
    }
    await db.query("COMMIT");
    return { sections: sectionLocators.size, passages: plan.passages.length };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

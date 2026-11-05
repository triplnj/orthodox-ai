/**
 * Isolated read-only semantic search over the additive library.
 * NOT imported by the production chat pipeline. The caller supplies both
 * a staging SQL client and a 1536-dimensional query embedding.
 */
import type { SqlClient } from "./stage-import";
export type LibrarySearchHit = {
  passageId: string;
  authorName: string;
  workTitle: string;
  corpus: string;
  editionTitle: string;
  sourceUrl: string;
  locator: string;
  content: string;
  previousContent: string | null;
  nextContent: string | null;
  score: number;
};
export type LibrarySearchOptions = {
  authorId?: string;
  corpus?: "PG" | "PL" | "PHILOKALIA" | "MODERN_ORTHODOX" | "CURATED_OTHER";
  limit?: number;
};

function validateVector(vector: number[]) {
  if (!Array.isArray(vector) || vector.length !== 1536 ||
      vector.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("Expected a 1536-dimensional finite query vector");
  }
}

export async function searchLibraryPassages(
  db: SqlClient,
  queryVector: number[],
  options: LibrarySearchOptions = {},
): Promise<LibrarySearchHit[]> {
  validateVector(queryVector);
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) {
    throw new RangeError("limit must be from 1 to 15");
  }
  const vector = "[" + queryVector.join(",") + "]";
  const query = `
    SELECT p."id" AS "passageId", a."canonicalName" AS "authorName",
      w."title" AS "workTitle", e."corpus", e."editionTitle", e."sourceUrl",
      p."locator", p."content", prev."content" AS "previousContent",
      nxt."content" AS "nextContent",
      1 - (p."embedding" <=> $1::vector) AS "score"
    FROM "LibraryPassage" p
    JOIN "LibraryEdition" e ON e."id" = p."editionId"
    JOIN "LibraryWork" w ON w."id" = e."workId"
    JOIN "LibraryAuthor" a ON a."id" = w."authorId"
    LEFT JOIN "LibraryPassage" prev ON prev."editionId" = p."editionId"
      AND prev."locator" = p."locator" AND prev."ordinal" = p."ordinal" - 1
    LEFT JOIN "LibraryPassage" nxt ON nxt."editionId" = p."editionId"
      AND nxt."locator" = p."locator" AND nxt."ordinal" = p."ordinal" + 1
    WHERE e."importStatus" = 'ACTIVE' AND p."embedding" IS NOT NULL
      AND ($2::text IS NULL OR w."authorId" = $2)
      AND ($3::text IS NULL OR e."corpus" = $3)
    ORDER BY p."embedding" <=> $1::vector, p."id" LIMIT $4
  `;
  const result = await db.query(query, [
    vector, options.authorId ?? null, options.corpus ?? null, limit,
  ]);
  return (result.rows ?? []) as LibrarySearchHit[];
}

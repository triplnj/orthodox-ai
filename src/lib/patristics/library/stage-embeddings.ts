/**
 * Optional staging-only embedding worker. Explicitly injected embedding provider:
 * no automatic requests, no live-chat dependency, no production activation.
 */
import type { SqlClient } from "./stage-import";

export type PassageForEmbedding = {
  id: string;
  content: string;
};

export type EmbedText = (text: string) => Promise<number[]>;

function checkVector(vector: number[]): void {
  if (vector.length !== 1536 ||
      vector.some(value => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Embedding must have 1536 finite dimensions");
  }
}

export async function indexStagedPassages(
  client: SqlClient,
  editionId: string,
  embed: EmbedText,
  batchSize = 8,
): Promise<number> {
  if (!editionId || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
    throw new Error("Invalid edition or embedding batch size");
  }
  const selected = await client.query(
    'SELECT p."id",p."content" FROM "LibraryPassage" p JOIN "LibraryEdition" e ON e."id"=p."editionId" ' +
    'WHERE e."id"=$1 AND e."importStatus"=\'STAGED\' AND p."embedding" IS NULL ' +
    'ORDER BY p."ordinal" LIMIT $2',
    [editionId, batchSize],
  );
  const rows = (selected.rows ?? []) as PassageForEmbedding[];
  const payload: Array<{ id: string; vector: string }> = [];
  for (const row of rows) {
    const vector = await embed(row.content);
    checkVector(vector);
    payload.push({ id: row.id, vector: "[" + vector.join(",") + "]" });
  }
  if (!payload.length) return 0;
  await client.query("BEGIN");
  try {
    let updated = 0;
    for (const row of payload) {
      const result = await client.query(
        'UPDATE "LibraryPassage" p SET "embedding"=$1::vector ' +
        'FROM "LibraryEdition" e WHERE p."id"=$2 AND p."editionId"=e."id" ' +
        'AND e."id"=$3 AND e."importStatus"=\'STAGED\' AND p."embedding" IS NULL',
        [row.vector, row.id, editionId],
      );
      updated += result.rowCount ?? 0;
    }
    if (updated !== payload.length) throw new Error("Concurrent edition change; rollback embeddings");
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

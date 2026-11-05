/**
 * Read-only retrieval evaluation against explicitly isolated Neon staging.
 * Does not change edition status, embeddings, tables, or the live chat path.
 * Produces auditable results with author/work/edition/locator provenance.
 */
import pg from "pg";
import OpenAI from "openai";
import { pathToFileURL } from "node:url";

const { Client } = pg;
const CORPORA = new Set(["PG","PL","PHILOKALIA","MODERN_ORTHODOX","CURATED_OTHER"]);

function parseArgs(argv) {
  const get = flag => {
    const i = argv.indexOf(flag);
    return i < 0 ? undefined : argv[i + 1];
  };
  const query = get("--question");
  const author = get("--author-id");
  const corpus = get("--corpus");
  const limit = get("--limit") === undefined ? 5 : Number(get("--limit"));
  if (typeof query !== "string" || !query.trim() ||
      query.length > 2000 || !Number.isInteger(limit) || limit < 1 || limit > 10 ||
      (author !== undefined && !/^[\w-]{1,100}$/.test(author)) ||
      (corpus !== undefined && !CORPORA.has(corpus))) {
    throw new Error("Usage: --question <text> [--author-id <id>] [--corpus PG|PL|PHILOKALIA|MODERN_ORTHODOX|CURATED_OTHER] [--limit 1..10]");
  }
  return { query: query.trim(), author: author ?? null, corpus: corpus ?? null, limit };
}

export async function evaluate(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const params = parseArgs(argv);
  if (!env.LIBRARY_STAGING_DB_URL || !env.LIBRARY_STAGING_BRANCH_ID || !env.OPENAI_API_KEY) {
    throw new Error("Staging DB URL, branch ID and OpenAI key must be provided separately");
  }
  const url = new URL(env.LIBRARY_STAGING_DB_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !/\.neon\.tech$/i.test(url.hostname) || !url.username ||
      !/^br-[a-z0-9-]+$/.test(env.LIBRARY_STAGING_BRANCH_ID)) {
    throw new Error("Invalid Neon staging configuration");
  }
  const db = deps.db ?? new Client({
    connectionString: env.LIBRARY_STAGING_DB_URL,
    ssl: { rejectUnauthorized: true },
  });
  const ai = deps.ai ?? new OpenAI({ apiKey: env.OPENAI_API_KEY });
  await db.connect();
  try {
    const guard = await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
    if (guard.rows.length !== 1 ||
        guard.rows[0].branchId !== env.LIBRARY_STAGING_BRANCH_ID ||
        guard.rows[0].purpose !== "PATRISTIC_LIBRARY_STAGING") {
      throw new Error("Refusing evaluation: wrong database branch");
    }
    const answer = await ai.embeddings.create({
      model: "text-embedding-3-small",
      input: params.query, encoding_format: "float",
    });
    const v = answer.data?.[0]?.embedding;
    if (!Array.isArray(v) || v.length !== 1536 ||
        v.some(x => typeof x !== "number" || !Number.isFinite(x))) {
      throw new Error("Invalid question embedding");
    }

    // STAGED is intentionally permitted here for offline QA, never in chat.
    const result = await db.query(`
      SELECT a."canonicalName" AS "authorName",w."title" AS "workTitle",
        e."corpus",e."editionTitle",e."sourceUrl",e."importStatus",
        p."locator",p."content",p."id" AS "passageId",
        1 - (p."embedding" <=> $1::vector) AS "similarity",
        prev."content" AS "previousContent",nxt."content" AS "nextContent"
      FROM "LibraryPassage" p
      JOIN "LibraryEdition" e ON e."id"=p."editionId"
      JOIN "LibraryWork" w ON w."id"=e."workId"
      JOIN "LibraryAuthor" a ON a."id"=w."authorId"
      LEFT JOIN "LibraryPassage" prev
        ON prev."editionId"=p."editionId" AND prev."locator"=p."locator"
        AND prev."ordinal"=p."ordinal"-1
      LEFT JOIN "LibraryPassage" nxt
        ON nxt."editionId"=p."editionId" AND nxt."locator"=p."locator"
        AND nxt."ordinal"=p."ordinal"+1
      WHERE e."importStatus"='STAGED' AND p."embedding" IS NOT NULL
        AND ($2::text IS NULL OR w."authorId"=$2)
        AND ($3::text IS NULL OR e."corpus"=$3)
      ORDER BY p."embedding" <=> $1::vector,p."id" LIMIT $4
    `, ["[" + v.join(",") + "]",params.author,params.corpus,params.limit]);
    return {
      question: params.query,
      authorFilter: params.author,
      corpusFilter: params.corpus,
      hits: result.rows.map(row => ({
        author: row.authorName, work: row.workTitle,
        corpus: row.corpus, edition: row.editionTitle,
        sourceUrl: row.sourceUrl, locator: row.locator,
        similarity: Number(row.similarity),
        excerpt: row.content, before: row.previousContent, after: row.nextContent,
      })),
    };
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  evaluate().then(value => process.stdout.write(JSON.stringify(value,null,2) + "\n"))
    .catch(err => { process.stderr.write(err.message + "\n"); process.exitCode = 1; });
}

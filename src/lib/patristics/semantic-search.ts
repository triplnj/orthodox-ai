import { prisma } from "@/lib/prisma";
import { createEmbedding } from "./embeddings";

export type SemanticPatristicQuote = {
  id: string;
  authorName: string;
  workTitle: string;
  originalLanguage: string;
  originalText: string;
  translationSr: string | null;
  translationEn: string | null;
  section: string | null;
  chapter: string | null;
  paragraph: string | null;
  pgReference: string | null;
  scReference: string | null;
  cpgReference: string | null;
  topics: string[];
  verification: string;
  confidence: number;
  similarity: number;
    sources: {
    url: string;
    sourceName: string | null;
    sourceType: string | null;
    exactMatch: boolean;
  }[];
};

export async function semanticSearchPatristicQuotes(
  query: string,
  limit = 5,
  minSimilarity = 0.55,
  authorName?: string,
): Promise<SemanticPatristicQuote[]> {
  const embedding = await createEmbedding(query);

  const vector = `[${embedding.join(",")}]`;
  const authorFilter = authorName
  ? `AND LOWER(q."authorName") = LOWER($4)`
  : "";

  const results = await prisma.$queryRawUnsafe<SemanticPatristicQuote[]>(
    `
    SELECT
      q."id",
      q."authorName",
      q."workTitle",
      q."originalLanguage",
      q."originalText",
      q."translationSr",
      q."translationEn",
      q."section",
      q."chapter",
      q."paragraph",
      q."pgReference",
      q."scReference",
      q."cpgReference",
      q."topics",
      q."verification",
      q."confidence",
      1 - (q."embedding" <=> $1::vector) AS "similarity"
    FROM "PatristicQuote" q
    WHERE
      q."verification" = 'MULTI_SOURCE_VERIFIED'
      AND q."confidence" >= 90
      AND q."embedding" IS NOT NULL
      AND 1 - (q."embedding" <=> $1::vector) >= $3
      ${authorFilter}
    ORDER BY q."embedding" <=> $1::vector
    LIMIT $2
    `,
    vector,
    limit,
    minSimilarity,
    ...(authorName ? [authorName] : []),
  );

  return results;
}
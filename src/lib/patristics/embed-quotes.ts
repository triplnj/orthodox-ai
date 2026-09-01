import { prisma } from "@/lib/prisma";

import {
  buildQuoteEmbeddingText,
  createEmbedding,
} from "./embeddings";


function vectorToSql(
  embedding: number[],
) {
  return `[${embedding.join(",")}]`;
}


export async function embedVerifiedQuotes(
  quoteIds?: string[],
) {
  const quotes =
    await prisma.patristicQuote.findMany({
      where: {
        verification:
          "MULTI_SOURCE_VERIFIED",

        confidence: {
          gte: 90,
        },

        ...(quoteIds &&
        quoteIds.length > 0
          ? {
              id: {
                in: quoteIds,
              },
            }
          : {}),
      },

      select: {
        id: true,
        authorName: true,
        workTitle: true,
        originalText: true,
        translationEn: true,
        translationSr: true,
        topics: true,
      },
    });


  let embedded = 0;
  let failed = 0;


  for (const quote of quotes) {
    try {
      const text =
        buildQuoteEmbeddingText(
          quote,
        );

      const embedding =
        await createEmbedding(text);

      const vector =
        vectorToSql(embedding);


      await prisma.$executeRawUnsafe(
        `
        UPDATE "PatristicQuote"
        SET "embedding" = $1::vector
        WHERE "id" = $2
        `,
        vector,
        quote.id,
      );


      embedded++;

    } catch (error) {

      console.error(
        "EMBED_QUOTE_ERROR",
        quote.id,
        error,
      );

      failed++;
    }
  }


  return {
    total: quotes.length,
    embedded,
    failed,
  };
}
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createEmbedding(
  text: string,
) {
  const response =
    await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

  return response.data[0].embedding;
}


export function buildQuoteEmbeddingText(
  quote: {
    authorName: string;
    workTitle: string;
    originalText: string;
    translationEn: string | null;
    translationSr: string | null;
    topics: string[];
  },
) {
  return `
Author: ${quote.authorName}
Work: ${quote.workTitle}

English:
${quote.translationEn ?? ""}

Serbian:
${quote.translationSr ?? ""}

Original:
${quote.originalText}

Topics:
${quote.topics.join(", ")}
  `.trim();
}
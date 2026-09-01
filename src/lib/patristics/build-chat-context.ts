import { prisma } from "@/lib/prisma";
import { semanticSearchPatristicQuotes } from "./semantic-search";
import { detectPatristicAuthor } from "./detect-author";
import { calculateHybridScore } from "./hybrid-score";

export async function buildPatristicContext(
  query: string,
  language: "sr" | "en",
) {
  const detectedAuthor = await detectPatristicAuthor(query);

  const minSimilarity = detectedAuthor ? 0.55 : 0.0;

  const quotes = await semanticSearchPatristicQuotes(
    query,
    5,
    minSimilarity,
    detectedAuthor,
  );

  const rankedQuotes = quotes
    .map((quote) => ({
      ...quote,
      hybrid: calculateHybridScore(query, quote),
    }))
    .sort(
      (a, b) =>
        b.hybrid.hybridScore - a.hybrid.hybridScore,
    );

  const filteredQuotes = rankedQuotes.filter(
    (quote) => quote.hybrid.hybridScore >= 0.35,
  );

  const usableQuotes = filteredQuotes.filter((quote) =>
    language === "sr"
      ? Boolean(quote.translationSr)
      : Boolean(quote.translationEn),
  );

  if (usableQuotes.length === 0) {
    return "No sufficiently relevant verified patristic records were found.";
  }

  const ids = usableQuotes.map((quote) => quote.id);

  const sources = await prisma.patristicQuoteSource.findMany({
    where: {
      quoteId: {
        in: ids,
      },
      exactMatch: true,
    },
  });

  const sourcesByQuote = new Map<
    string,
    typeof sources
  >();

  for (const source of sources) {
    const existing = sourcesByQuote.get(source.quoteId) ?? [];
    existing.push(source);
    sourcesByQuote.set(source.quoteId, existing);
  }

  return usableQuotes
    .map((quote, index) => {
      const quoteSources = sourcesByQuote.get(quote.id) ?? [];

      const textToUse =
        language === "sr"
          ? quote.translationSr ?? quote.originalText
          : quote.translationEn ?? quote.originalText;

      const references = [
        quote.pgReference,
        quote.scReference,
        quote.cpgReference,
      ]
        .filter(Boolean)
        .join("; ");

      const verifiedSources =
        quoteSources.length > 0
          ? quoteSources
              .map((source) => {
                const details = [
                  source.sourceName,
                  source.page
                    ? `page ${source.page}`
                    : null,
                  source.column
                    ? `column ${source.column}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ");

                return `- ${
                  details || "Verified source"
                }: ${source.url}`;
              })
              .join("\n")
          : "- No source URL available.";

      return `
[PATRISTIC_RECORD_${index + 1}]
STATUS: VERIFIED DATABASE RECORD
AUTHOR: ${quote.authorName}
WORK: ${quote.workTitle}
SECTION: ${quote.section ?? "Not specified"}
CHAPTER: ${quote.chapter ?? "Not specified"}
PARAGRAPH: ${quote.paragraph ?? "Not specified"}
REFERENCE: ${references || "Not specified"}
QUOTE_TO_USE:
${textToUse}

ORIGINAL_TEXT:
${quote.originalText}

ORIGINAL_LANGUAGE: ${quote.originalLanguage}
VERIFICATION: ${quote.verification}
CONFIDENCE: ${quote.confidence}
SEMANTIC_SIMILARITY: ${quote.similarity.toFixed(4)}
KEYWORD_SCORE: ${quote.hybrid.keywordScore.toFixed(4)}
HYBRID_SCORE: ${quote.hybrid.hybridScore.toFixed(4)}

VERIFIED_SOURCES:
${verifiedSources}
[/PATRISTIC_RECORD_${index + 1}]
`.trim();
    })
    .join("\n\n");
}
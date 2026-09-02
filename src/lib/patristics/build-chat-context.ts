import { detectPatristicAuthor } from "./detect-author";
import { formatPatristicQuote } from "./format-quote";
import { hybridScore } from "./hybrid-score";
import { semanticSearchPatristicQuotes } from "./semantic-search";

export type PatristicLanguage = "sr" | "en";

export async function buildPatristicContext(
  query: string,
  language: PatristicLanguage,
): Promise<string> {
  const detectedAuthor =
    await detectPatristicAuthor(query);

  const minSimilarity =
    detectedAuthor ? 0.55 : 0.0;

  console.log(
    "PATRISTIC_RETRIEVAL_INPUT:",
    {
      query,
      language,
      detectedAuthor,
      minSimilarity,
    },
  );

  const semanticQuotes =
    await semanticSearchPatristicQuotes(
      query,
      5,
      minSimilarity,
      detectedAuthor ?? undefined,
    );

  console.log(
    "PATRISTIC_RETRIEVAL_RESULTS:",
    semanticQuotes.map((quote) => ({
      id: quote.id,
      authorName: quote.authorName,
      workTitle: quote.workTitle,
      similarity: quote.similarity,
      verification: quote.verification,
      confidence: quote.confidence,
      hasTranslationSr:
        Boolean(quote.translationSr),
      hasTranslationEn:
        Boolean(quote.translationEn),
    })),
  );

  const rankedQuotes =
    semanticQuotes
      .map((quote) => ({
        quote,
        score: hybridScore(
          query,
          quote,
        ),
      }))
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  console.log(
    "PATRISTIC_HYBRID_RESULTS:",
    rankedQuotes.map(
      ({ quote, score }) => ({
        id: quote.id,
        authorName:
          quote.authorName,
        workTitle:
          quote.workTitle,
        similarity:
          quote.similarity,
        hybridScore: score,
      }),
    ),
  );

  const usableQuotes =
    rankedQuotes
      .filter(
        ({ quote, score }) => {
          if (score < 0.35) {
            return false;
          }

          if (
            language === "sr" &&
            !quote.translationSr
          ) {
            return false;
          }

          if (
            language === "en" &&
            !quote.translationEn
          ) {
            return false;
          }

          return true;
        },
      )
      .slice(0, 3);

  console.log(
    "PATRISTIC_USABLE_QUOTES:",
    usableQuotes.map(
      ({ quote, score }) => ({
        id: quote.id,
        authorName:
          quote.authorName,
        workTitle:
          quote.workTitle,
        similarity:
          quote.similarity,
        hybridScore: score,
      }),
    ),
  );

  if (usableQuotes.length === 0) {
    return "";
  }

  const records =
    usableQuotes.map(
      ({ quote }, index) => {
        const formatted =
          formatPatristicQuote(
            quote,
            language,
          );

        return [
          `[PATRISTIC_RECORD_${index + 1}]`,
          formatted,
          `[/PATRISTIC_RECORD_${index + 1}]`,
        ].join("\n");
      },
    );

  return [
    "VERIFIED PATRISTIC DATABASE CONTEXT:",
    "",
    ...records,
  ].join("\n\n");
}
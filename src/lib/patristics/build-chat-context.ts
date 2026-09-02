import { detectPatristicAuthor } from "./detect-author";
import { formatPatristicQuote } from "./format-quote";
import { calculateHybridScore } from "./hybrid-score";
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
      .map((quote) => {
        const scores =
          calculateHybridScore(
            query,
            quote,
          );

        return {
          quote,
          ...scores,
        };
      })
      .sort(
        (a, b) =>
          b.hybridScore -
          a.hybridScore,
      );

  console.log(
    "PATRISTIC_HYBRID_RESULTS:",
    rankedQuotes.map(
      ({
        quote,
        semanticScore,
        keywordScore,
        hybridScore,
        matchedTerms,
        totalTerms,
      }) => ({
        id: quote.id,
        authorName:
          quote.authorName,
        workTitle:
          quote.workTitle,
        semanticScore,
        keywordScore,
        hybridScore,
        matchedTerms,
        totalTerms,
      }),
    ),
  );

  const usableQuotes =
    rankedQuotes
      .filter((item) => {
        if (
          item.hybridScore < 0.35
        ) {
          return false;
        }

        if (
          language === "sr" &&
          !item.quote.translationSr
        ) {
          return false;
        }

        if (
          language === "en" &&
          !item.quote.translationEn
        ) {
          return false;
        }

        return true;
      })
      .slice(0, 3);

  console.log(
    "PATRISTIC_USABLE_QUOTES:",
    usableQuotes.map(
      (item) => ({
        id: item.quote.id,
        authorName:
          item.quote.authorName,
        workTitle:
          item.quote.workTitle,
        semanticScore:
          item.semanticScore,
        keywordScore:
          item.keywordScore,
        hybridScore:
          item.hybridScore,
      }),
    ),
  );

  if (usableQuotes.length === 0) {
    return "";
  }

  const records =
    usableQuotes.map(
      (item, index) => {
        const formatted =
          formatPatristicQuote(
            item.quote,
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
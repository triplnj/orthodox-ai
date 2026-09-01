type PatristicQuoteForDisplay = {
  authorName: string;
  workTitle: string;

  originalLanguage: string;
  originalText: string;

  translationSr: string | null;
  translationEn: string | null;

  pgReference: string | null;

  verification: string;
  confidence: number;
};


export function formatPatristicQuote(
  quote: PatristicQuoteForDisplay,
  language: "sr" | "en",
) {
  const translation =
    language === "sr"
      ? quote.translationSr
      : quote.translationEn;


  return {
    author: quote.authorName,
    work: quote.workTitle,

    text:
      translation ??
      quote.originalText,

    original:
      quote.originalText,

    originalLanguage:
      quote.originalLanguage,

    reference:
      quote.pgReference,

    verification:
      quote.verification,

    confidence:
      quote.confidence,
  };
}
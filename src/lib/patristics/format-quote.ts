type PatristicQuoteForDisplay = {
  authorName: string;
  workTitle: string;

  originalLanguage: string;
  originalText: string;

  translationSr: string | null;
  translationEn: string | null;

  section?: string | null;
  chapter?: string | null;
  paragraph?: string | null;

  pgReference: string | null;
  scReference?: string | null;
  cpgReference?: string | null;

  verification: string;
  confidence: number;
};

export function formatPatristicQuote(
  quote: PatristicQuoteForDisplay,
  language: "sr" | "en",
): string {
  const translation =
    language === "sr"
      ? quote.translationSr
      : quote.translationEn;

  const quoteToUse =
    translation ??
    quote.originalText;

  return [
    `AUTHOR: ${quote.authorName}`,
    `WORK: ${quote.workTitle}`,

    `SECTION: ${
      quote.section ??
      "Not specified"
    }`,

    `CHAPTER: ${
      quote.chapter ??
      "Not specified"
    }`,

    `PARAGRAPH: ${
      quote.paragraph ??
      "Not specified"
    }`,

    `PG_REFERENCE: ${
      quote.pgReference ??
      "Not specified"
    }`,

    `SC_REFERENCE: ${
      quote.scReference ??
      "Not specified"
    }`,

    `CPG_REFERENCE: ${
      quote.cpgReference ??
      "Not specified"
    }`,

    `ORIGINAL_LANGUAGE: ${quote.originalLanguage}`,

    `ORIGINAL_TEXT:`,
    quote.originalText,

    `QUOTE_TO_USE:`,
    quoteToUse,

    `VERIFICATION: ${quote.verification}`,
    `CONFIDENCE: ${quote.confidence}`,
  ].join("\n");
}
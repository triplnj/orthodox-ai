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

  sources?: {
    url: string;
    sourceName: string | null;
    sourceType: string | null;
    exactMatch: boolean;
  }[];
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

  const verifiedSources =
    quote.sources
      ?.filter(
        (source) =>
          source.exactMatch,
      )
      .map(
        (source, index) =>
          [
            `SOURCE_${index + 1}:`,
            `URL: ${source.url}`,
            `NAME: ${
              source.sourceName ??
              "Not specified"
            }`,
            `TYPE: ${
              source.sourceType ??
              "Not specified"
            }`,
          ].join("\n"),
      )
      .join("\n\n") ||
    "No verified source URL supplied.";

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

    `VERIFIED_SOURCES:`,
    verifiedSources,
  ].join("\n");
}
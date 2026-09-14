import { detectPatristicAuthor } from "./detect-author";
import { formatPatristicQuote } from "./format-quote";
import { calculateHybridScore } from "./hybrid-score";
import { semanticSearchPatristicQuotes } from "./semantic-search";

export type PatristicLanguage = "sr" | "en";

export type VerifiedPatristicSource = {
  authorName: string;
  workTitle: string;
  originalLanguage: string;
  reference: string | null;
  sourceUrl: string;
  sourceName: string | null;
  verificationStatus: string;
};

export type VerifiedPatristicContextResult = {
  context: string;
  sources: VerifiedPatristicSource[];
};

function buildReference(
  quote: {
    pgReference: string | null;
    scReference: string | null;
    cpgReference: string | null;
    section: string | null;
    chapter: string | null;
    paragraph: string | null;
  },
) {
  return (
    quote.pgReference ??
    quote.scReference ??
    quote.cpgReference ??
    quote.section ??
    quote.chapter ??
    quote.paragraph ??
    null
  );
}

export async function buildVerifiedPatristicContext(
  query: string,
  language: PatristicLanguage,
): Promise<VerifiedPatristicContextResult | null> {
  const detectedAuthor =
    await detectPatristicAuthor(query);

  const minSimilarity = 0.0;

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
    return null;
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

  const sources: VerifiedPatristicSource[] =
    usableQuotes.flatMap(
      (item) =>
        item.quote.sources
          .filter(
            (source) =>
              source.exactMatch,
          )
          .map(
            (source) => ({
              authorName:
                item.quote.authorName,
              workTitle:
                item.quote.workTitle,
              originalLanguage:
                item.quote.originalLanguage,
              reference:
                buildReference(
                  item.quote,
                ),
              sourceUrl:
                source.url,
              sourceName:
                source.sourceName,
              verificationStatus:
                item.quote.verification,
            }),
          ),
    );

  return {
    context: [
      "VERIFIED PATRISTIC DATABASE CONTEXT:",
      "",
      ...records,
    ].join("\n\n"),
    sources,
  };
}

export async function buildPatristicContext(
  query: string,
  language: PatristicLanguage,
): Promise<string> {
  const result =
    await buildVerifiedPatristicContext(
      query,
      language,
    );

  return result?.context ?? "";
}

import {
  fetchSourceText,
} from "./fetch-source";

import {
  buildTextSearchTerms,
} from "./build-text-search-terms";

import {
  findCuratedPatristicDocuments,
  type CuratedPatristicDocument,
} from "./curated-text-sources";

export type CuratedTextEvidence = {
  authorName: string;

  workTitle: string;

  originalLanguage: string;

  sourceUrl: string;

  sourceName: string;

  documentType:
    CuratedPatristicDocument[
      "documentType"
    ];

  verificationStatus: string;

  excerpt: string;

  matchedTerms: string[];
};

function normalize(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function countOccurrences(
  text: string,
  term: string,
) {
  if (!term) {
    return 0;
  }

  let count = 0;
  let start = 0;

  while (true) {
    const index =
      text.indexOf(
        term,
        start,
      );

    if (index === -1) {
      return count;
    }

    count += 1;
    start =
      index +
      Math.max(
        term.length,
        1,
      );
  }
}

function buildWindows(
  text: string,
  size = 2600,
  overlap = 500,
) {
  const cleaned =
    text
      .replace(
        /[ \t]+/g,
        " ",
      )
      .replace(
        /\n{3,}/g,
        "\n\n",
      )
      .trim();

  if (!cleaned) {
    return [];
  }

  if (
    cleaned.length <= size
  ) {
    return [
      cleaned,
    ];
  }

  const windows:
    string[] = [];

  const step =
    Math.max(
      500,
      size - overlap,
    );

  for (
    let start = 0;
    start < cleaned.length;
    start += step
  ) {
    const end =
      Math.min(
        cleaned.length,
        start + size,
      );

    windows.push(
      cleaned.slice(
        start,
        end,
      ),
    );

    if (
      end === cleaned.length
    ) {
      break;
    }
  }

  return windows;
}

function rankWindows(
  text: string,
  terms: string[],
) {
  const normalizedTerms =
    [
      ...new Set(
        terms
          .map(
            normalize,
          )
          .filter(Boolean),
      ),
    ];

  const windows =
    buildWindows(
      text,
    );

  return windows
    .map(
      (
        excerpt,
        index,
      ) => {
        const normalizedExcerpt =
          normalize(
            excerpt,
          );

        const matchedTerms =
          normalizedTerms.filter(
            (term) =>
              normalizedExcerpt.includes(
                term,
              ),
          );

        const score =
          matchedTerms.reduce(
            (
              total,
              term,
            ) =>
              total +
              countOccurrences(
                normalizedExcerpt,
                term,
              ),
            0,
          );

        return {
          excerpt,
          index,
          matchedTerms,
          score,
        };
      },
    )
    .filter(
      (item) =>
        item.score > 0,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.index - b.index,
    );
}

export async function searchCuratedPatristicTexts(
  query: string,
  limit = 5,
): Promise<
  CuratedTextEvidence[]
> {
  const documents =
    findCuratedPatristicDocuments(
      query,
    );

  if (
    documents.length === 0
  ) {
    return [];
  }

  const termsByLanguage =
    new Map<
      string,
      string[]
    >();

  const evidence:
    CuratedTextEvidence[] =
      [];

  for (
    const document of
    documents
  ) {
    let terms =
      termsByLanguage.get(
        document.sourceLanguage,
      );

    if (!terms) {
      try {
        const generated =
          await buildTextSearchTerms(
            query,
            document.sourceLanguage,
          );

        terms =
          generated.terms;

        termsByLanguage.set(
          document.sourceLanguage,
          terms,
        );
      } catch (error) {
        console.error(
          "CURATED_TEXT_SEARCH_TERMS_ERROR:",
          error,
        );

        terms = [];
      }
    }

    try {
      const source =
        await fetchSourceText(
          document.sourceUrl,
        );

      const ranked =
        rankWindows(
          source.text,
          terms,
        );

      const selected =
        ranked.length > 0
          ? ranked.slice(
              0,
              document.documentType ===
                "BIBLIOGRAPHIC"
                ? 1
                : 2,
            )
          : source.text
              .trim()
            ? [
                {
                  excerpt:
                    source.text
                      .trim()
                      .slice(
                        0,
                        3500,
                      ),

                  matchedTerms:
                    [] as string[],
                },
              ]
            : [];

      for (
        const item of selected
      ) {
        evidence.push({
          authorName:
            document.authorName,

          workTitle:
            document.workTitle,

          originalLanguage:
            document.sourceLanguage,

          sourceUrl:
            document.sourceUrl,

          sourceName:
            document.sourceName,

          documentType:
            document.documentType,

          verificationStatus:
            document.verificationStatus,

          excerpt:
            item.excerpt,

          matchedTerms:
            item.matchedTerms,
        });
      }
    } catch (error) {
      console.error(
        "CURATED_PATRISTIC_SOURCE_ERROR:",
        {
          source:
            document.key,

          error,
        },
      );
    }
  }

  return evidence
    .slice(
      0,
      limit,
    );
}

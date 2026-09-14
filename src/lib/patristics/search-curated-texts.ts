import {
  fetchSourceText,
} from "./fetch-source";

import {
  expandCuratedSearchTerms,
} from "./expand-curated-search-terms";

import {
  findCuratedPatristicDocuments,
  type CuratedPatristicDocument,
} from "./curated-text-sources";

import {
  searchWikisourceCollection,
} from "./search-wikisource-collection";

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
      terms =
        expandCuratedSearchTerms(
          query,
          [],
          document.sourceLanguage,
        );

      termsByLanguage.set(
        document.sourceLanguage,
        terms,
      );
    }

    console.log(
      "CURATED_DETERMINISTIC_TERMS:",
      {
        query,
        source:
          document.key,
        language:
          document.sourceLanguage,
        terms,
      },
    );

    try {
      /*
       * Large scanned editions are not downloaded
       * and parsed inside a chat request. When a
       * curated work has a Wikisource collection,
       * search only that fixed work and fetch the
       * relevant homily pages.
       */
      if (
        document.wikisourceTitlePrefix
      ) {
        const pages =
          await searchWikisourceCollection(
            document,
            terms,
          );

        for (
          const page of pages
        ) {
          const ranked =
            rankWindows(
              page.text,
              terms,
            );

          for (
            const item of
            ranked.slice(0, 2)
          ) {
            evidence.push({
              authorName:
                document.authorName,

              workTitle:
                `${document.workTitle} — ${page.title.replace(document.wikisourceTitlePrefix, "")}`,

              originalLanguage:
                document.sourceLanguage,

              sourceUrl:
                page.url,

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
        }

        continue;
      }

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
          : terms.length === 0 &&
              source.text
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

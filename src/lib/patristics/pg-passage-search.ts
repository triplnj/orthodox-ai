import * as cheerio from "cheerio";

import {
  buildPgSearchPlan,
} from "./build-pg-search-plan";

import {
  buildGreekSearchTerms,
} from "./build-greek-search-terms";

import {
  resolvePgVolumeSource,
} from "./pg-volume-source";

import {
  mapPgColumnsToScanRange,
  parsePgColumnRange,
  type PgScanRange,
  type PgWorkColumnRange,
} from "./pg-work-range";


export type PgPassageMatch = {
  authorName: string;

  candidateWorkTitles: string[];

  pgVolume: number;

  workPgColumns: string[];

  scanPage: number;

  queryTerms: string[];

  matchedTerms: string[];

  originalText: string;

  contextText: string;

  sourceUrl: string;

  pageImageUrl: string;

  authorSource:
    | "LOCAL_INDEX"
    | "AI_CANDIDATE";

  authorVolumeVerified: boolean;
};


function normalizeGreek(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}


function uniqueStrings(
  values: string[],
) {
  return [
    ...new Set(
      values
        .map(
          normalizeGreek,
        )
        .filter(Boolean),
    ),
  ];
}


function archivePageUrl(
  identifier: string,
  scanPage: number,
) {
  return (
    `https://archive.org/details/${identifier}` +
    `/page/n${scanPage}/mode/1up`
  );
}


async function fetchPgDjvuXml(
  volume: number,
) {
  const source =
    await resolvePgVolumeSource(
      volume,
    );


  if (!source) {
    return null;
  }


  const response =
    await fetch(
      source.djvuXmlUrl,
      {
        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
        },

        /*
         * DjVu XML for a PG volume can be tens of MB.
         * Never put it in the Next.js Data Cache: Vercel's
         * cache item limit is much smaller than these files.
         * We fetch it only for the current serverless request.
         */
        cache: "no-store",

        signal:
          AbortSignal.timeout(
            20_000,
          ),
      },
    );


  if (!response.ok) {
    return null;
  }


  return {
    xml:
      await response.text(),

    archiveIdentifier:
      source.archiveIdentifier,

    detailsUrl:
      source.detailsUrl,

    scandataUrl:
      source.scandataUrl,
  };
}


function extractParagraphsFromPage(
  pageElement:
    Parameters<
      cheerio.CheerioAPI
    >[0],

  $:
    cheerio.CheerioAPI,
) {
  const paragraphs: string[] =
    [];


  $(pageElement)
    .find("PARAGRAPH")
    .each(
      (_, paragraph) => {
        const words: string[] =
          [];


        $(paragraph)
          .find("WORD")
          .each(
            (_, word) => {
              const text =
                $(word)
                  .text()
                  .trim();


              if (text) {
                words.push(
                  text,
                );
              }
            },
          );


        const text =
          words
            .join(" ")
            .replace(
              /\s+/g,
              " ",
            )
            .trim();


        if (
          text.length >=
          40
        ) {
          paragraphs.push(
            text,
          );
        }
      },
    );


  return paragraphs;
}


function findMatchedTerms(
  text: string,
  terms: string[],
) {
  const normalizedText =
    normalizeGreek(
      text,
    );


  return terms.filter(
    (term) =>
      normalizedText.includes(
        normalizeGreek(
          term,
        ),
      ),
  );
}


type RawPageMatch = {
  scanPage: number;

  paragraphIndex: number;

  paragraph: string;

  context: string;

  matchedTerms: string[];
};


function searchPages(
  xml: string,
  terms: string[],
) {
  const $ =
    cheerio.load(
      xml,
      {
        xmlMode: true,
      },
    );


  const results:
    RawPageMatch[] =
      [];


  $("OBJECT").each(
    (
      pageIndex,
      page,
    ) => {
      const paragraphs =
        extractParagraphsFromPage(
          page,
          $,
        );


      paragraphs.forEach(
        (
          paragraph,
          paragraphIndex,
        ) => {
          const matchedTerms =
            findMatchedTerms(
              paragraph,
              terms,
            );


          if (
            matchedTerms.length ===
            0
          ) {
            return;
          }


          const before =
            paragraphs[
              paragraphIndex - 1
            ] ?? "";


          const after =
            paragraphs[
              paragraphIndex + 1
            ] ?? "";


          const context =
            [
              before,
              paragraph,
              after,
            ]
              .filter(Boolean)
              .join(" ")
              .replace(
                /\s+/g,
                " ",
              )
              .trim();


          results.push({
            scanPage:
              pageIndex,

            paragraphIndex,

            paragraph,

            context,

            matchedTerms,
          });
        },
      );
    },
  );


  return results;
}


export async function searchPgPassages(
  query: string,
  limit = 10,
): Promise<
  PgPassageMatch[]
> {
  const plan =
    await buildPgSearchPlan(
      query,
    );


  if (
    !plan.hasSpecificAuthor ||
    !plan.authorName ||
    !plan.routingVerified
  ) {
    return [];
  }


  const greekSearch =
    await buildGreekSearchTerms(
      query,
    );


  const terms =
    uniqueStrings([
      ...greekSearch.greekStems,

      ...(
        greekSearch.greekStems
          .length === 0
          ? greekSearch.greekTerms
          : []
      ),
    ]);


  if (
    terms.length === 0 ||
    plan.pgVolumes.length === 0
  ) {
    return [];
  }


  const allResults:
    PgPassageMatch[] =
      [];


  for (
    const volume of
    plan.pgVolumes
  ) {
    let fetched:
      Awaited<
        ReturnType<
          typeof fetchPgDjvuXml
        >
      >;


    try {
      fetched =
        await fetchPgDjvuXml(
          volume,
        );
    } catch {
      continue;
    }


    if (!fetched) {
      continue;
    }


    const {
      xml,
      archiveIdentifier,
      detailsUrl,
    } =
      fetched;


    let rawMatches =
      searchPages(
        xml,
        terms,
      );


    /*
     * Ako lokalni indeks zna PG kolone konkretnog
     * dela, stvarno ograničavamo pretragu na to delo.
     *
     * Scan-range se dobija dinamički iz Internet
     * Archive scandata.xml, bez ručnih scan anchor-a.
     */
    if (
      plan.hasSpecificWorks
    ) {
      const volumeWorkRanges =
        plan.works
          .filter(
            (work) =>
              work.pgVolume ===
              volume,
          )
          .map(
            (work) =>
              parsePgColumnRange(
                work.pgColumns,
              ),
          )
          .filter(
            (
              range,
            ): range is PgWorkColumnRange =>
              Boolean(range),
          );

      const scanRanges:
        PgScanRange[] = [];

      for (
        const range of
        volumeWorkRanges
      ) {
        const scanRange =
          await mapPgColumnsToScanRange(
            fetched.scandataUrl,
            range,
          );

        if (scanRange) {
          scanRanges.push(
            scanRange,
          );
        }
      }

      if (
        scanRanges.length > 0
      ) {
        console.log(
          "PATRISTIC_PG_WORK_RANGES:",
          {
            volume,
            workColumns:
              volumeWorkRanges,
            scanRanges,
          },
        );

        rawMatches =
          rawMatches.filter(
            (match) =>
              scanRanges.some(
                (range) =>
                  match.scanPage >=
                    range.firstScanPage &&
                  match.scanPage <=
                    range.lastScanPage,
              ),
          );
      }
    }


    /*
     * Za lokalno poznatog autora
     * možemo imati poznata dela.
     *
     * Kod AI fallback-a lista ostaje
     * prazna dok delo ne utvrdimo
     * drugim mehanizmom.
     */
    const volumeWorks =
      plan.hasSpecificWorks
        ? plan.works.filter(
            (work) =>
              work.pgVolume ===
              volume,
          )
        : plan.author
          ? plan.author.works.filter(
              (work) =>
                work.pgVolume ===
                volume,
            )
          : [];


    const candidateWorkTitles =
      [
        ...new Set(
          volumeWorks
            .map(
              (work) =>
                work.titleSr,
            )
            .filter(Boolean),
        ),
      ];


    const workPgColumns =
      [
        ...new Set(
          volumeWorks
            .map(
              (work) =>
                work.pgColumns,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      ];


    for (
      const match of
      rawMatches
    ) {
      allResults.push({
        authorName:
          plan.authorName,

        candidateWorkTitles,

        pgVolume:
          volume,

        workPgColumns,

        scanPage:
          match.scanPage,

        queryTerms:
          terms,

        matchedTerms:
          match.matchedTerms,

        originalText:
          match.paragraph,

        contextText:
          match.context,

        sourceUrl:
          detailsUrl,

        pageImageUrl:
          archivePageUrl(
            archiveIdentifier,
            match.scanPage,
          ),

        authorSource:
          plan.authorSource ??
          "AI_CANDIDATE",

        authorVolumeVerified:
          plan.authorVolumeVerified,
      });
    }
  }


  const conceptCount =
    greekSearch.concepts.length;

  const minimumMatchedTerms =
    plan.hasSpecificWorks ||
    conceptCount <= 1
      ? 1
      : Math.min(
          2,
          terms.length,
        );

  return allResults
    .filter(
      (match) =>
        match.matchedTerms.length >=
        minimumMatchedTerms,
    )
    .sort(
      (a, b) => {
        const scoreDifference =
          b.matchedTerms.length -
          a.matchedTerms.length;


        if (
          scoreDifference !==
          0
        ) {
          return scoreDifference;
        }


        if (
          a.pgVolume !==
          b.pgVolume
        ) {
          return (
            a.pgVolume -
            b.pgVolume
          );
        }


        return (
          a.scanPage -
          b.scanPage
        );
      },
    )
    .slice(
      0,
      limit,
    );
}
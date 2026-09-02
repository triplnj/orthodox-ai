import * as cheerio from "cheerio";

import {
  buildPgSearchPlan,
} from "./build-pg-search-plan";


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
};


const TOPIC_TERMS = [
  {
    test:
      /душ|soul|ψυχ/iu,

    terms: [
      "ψυχ",
    ],
  },

  {
    test:
      /смрт|смрти|death|θαν/iu,

    terms: [
      "θαν",
    ],
  },

  {
    test:
      /васкрс|resurrection|ἀνάστα|αναστα/iu,

    terms: [
      "αναστα",
    ],
  },

  {
    test:
      /ум\b|ума\b|mind|intellect|νοῦς|νους/iu,

    terms: [
      "νου",
    ],
  },

  {
    test:
      /љубав|love|ἀγάπ|αγαπ/iu,

    terms: [
      "αγαπ",
    ],
  },

  {
    test:
      /молит|prayer|pray|προσευχ/iu,

    terms: [
      "προσευχ",
    ],
  },
];


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
    .replace(/\s+/g, " ")
    .trim();
}


function detectGreekSearchTerms(
  query: string,
) {
  const terms: string[] = [];


  for (
    const topic of
    TOPIC_TERMS
  ) {
    if (
      topic.test.test(
        query,
      )
    ) {
      terms.push(
        ...topic.terms,
      );
    }
  }


  return [
    ...new Set(
      terms.map(
        normalizeGreek,
      ),
    ),
  ];
}


/*
 * Internet Archive PG kolekcija
 * uglavnom koristi ovaj obrazac
 * identifikatora.
 *
 * Više nemamo ručnu tabelu
 * PG 46 -> Gregory.
 *
 * Ako konkretan tom nije
 * dostupan pod ovim ID-em,
 * fetch će jednostavno vratiti
 * neuspeh i taj tom preskačemo.
 */
function getArchiveIdentifier(
  volume: number,
) {
  return (
    `patrologiaecursu${volume}mignuoft`
  );
}


function archiveDjvuXmlUrl(
  identifier: string,
) {
  return (
    `https://archive.org/download/${identifier}/` +
    `${identifier}_djvu.xml`
  );
}


function archiveDetailsUrl(
  identifier: string,
) {
  return (
    `https://archive.org/details/${identifier}`
  );
}


function archivePageUrl(
  identifier: string,
  scanPage: number,
) {
  return (
    `https://archive.org/details/${identifier}/page/n${scanPage}/mode/1up`
  );
}


async function fetchPgDjvuXml(
  volume: number,
) {
  const archiveIdentifier =
    getArchiveIdentifier(
      volume,
    );


  const url =
    archiveDjvuXmlUrl(
      archiveIdentifier,
    );


  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
        },

        next: {
          revalidate:
            60 *
            60 *
            24 *
            30,
        },
      },
    );


  if (!response.ok) {
    return null;
  }


  return {
    xml:
      await response.text(),

    archiveIdentifier,
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


  $(
    pageElement,
  )
    .find(
      "PARAGRAPH",
    )
    .each(
      (_, paragraph) => {
        const words: string[] =
          [];


        $(
          paragraph,
        )
          .find(
            "WORD",
          )
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
  const normalized =
    normalizeGreek(
      text,
    );


  return terms.filter(
    (term) =>
      normalized.includes(
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

  score: number;
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
              paragraphIndex -
                1
            ] ?? "";


          const after =
            paragraphs[
              paragraphIndex +
                1
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

            score:
              matchedTerms.length,
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
    buildPgSearchPlan(
      query,
    );


  if (
    !plan.hasSpecificAuthor ||
    !plan.author ||
    !plan.authorName
  ) {
    return [];
  }


  const terms =
    detectGreekSearchTerms(
      query,
    );


  if (
    terms.length === 0
  ) {
    return [];
  }


  /*
   * Tomove više ne određuje
   * ovaj fajl.
   *
   * Search plan je jedino mesto
   * koje odlučuje šta treba
   * pretraživati.
   */
  const volumes =
    plan.pgVolumes;


  if (
    volumes.length ===
    0
  ) {
    return [];
  }


  const allResults:
    PgPassageMatch[] =
      [];


  for (
    const volume of
    volumes
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
    } =
      fetched;


    const rawMatches =
      searchPages(
        xml,
        terms,
      );


    /*
     * Ako plan već zna konkretna
     * dela, koristimo samo njih.
     *
     * Ako ne zna, uzimamo sva
     * indeksirana dela autora
     * koja pripadaju tom tomu.
     */
    const volumeWorks =
      plan.hasSpecificWorks
        ? plan.works.filter(
            (work) =>
              work.pgVolume ===
              volume,
          )
        : plan.author.works.filter(
            (work) =>
              work.pgVolume ===
              volume,
          );


    const candidateWorkTitles =
      volumeWorks.map(
        (work) => {
          if (
            "titleSr" in work
          ) {
            return work.titleSr;
          }

          return "";
        },
      )
      .filter(Boolean);


    const workPgColumns =
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
        );


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
          archiveDetailsUrl(
            archiveIdentifier,
          ),

        pageImageUrl:
          archivePageUrl(
            archiveIdentifier,
            match.scanPage,
          ),
      });
    }
  }


  return allResults
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
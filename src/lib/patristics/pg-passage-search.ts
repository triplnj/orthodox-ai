import * as cheerio from "cheerio";

import {
  findPatristicAuthor,
  findRelevantWorks,
} from "./corpus-index";


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


type PgVolumeSource = {
  volume: number;

  archiveIdentifier: string;
};


const PG_VOLUME_SOURCES:
  PgVolumeSource[] = [
    {
      volume: 46,

      archiveIdentifier:
        "patrologiaecursu46mignuoft",
    },
  ];


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


function getPgVolumeSource(
  volume: number,
) {
  return (
    PG_VOLUME_SOURCES.find(
      (source) =>
        source.volume ===
        volume,
    ) ?? null
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
  const source =
    getPgVolumeSource(
      volume,
    );


  if (!source) {
    throw new Error(
      `No OCR source configured for PG ${volume}.`,
    );
  }


  const url =
    archiveDjvuXmlUrl(
      source.archiveIdentifier,
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
    throw new Error(
      `Could not fetch DjVu XML for PG ${volume}: ${response.status}`,
    );
  }


  return {
    xml:
      await response.text(),

    archiveIdentifier:
      source.archiveIdentifier,
  };
}


function extractParagraphsFromPage(
   pageElement: Parameters<cheerio.CheerioAPI>[0],
  $: cheerio.CheerioAPI,
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
    (pageIndex, page) => {
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
  const author =
    findPatristicAuthor(
      query,
    );


  if (!author) {
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


  const relevantWorks =
    findRelevantWorks(
      query,
      author,
    );


  const works =
    relevantWorks.length > 0
      ? relevantWorks
      : author.works;


  /*
   * Не претражујемо исти PG том
   * више пута само зато што се
   * у њему налази више дела.
   */
  const volumes = [
    ...new Set(
      works
        .map(
          (work) =>
            work.pgVolume,
        )
        .filter(
          (
            volume,
          ): volume is number =>
            typeof volume ===
            "number",
        ),
    ),
  ];


  const allResults:
    PgPassageMatch[] =
      [];


  for (
    const volume of
    volumes
  ) {
    const volumeSource =
      getPgVolumeSource(
        volume,
      );


    if (!volumeSource) {
      continue;
    }


    const {
      xml,
      archiveIdentifier,
    } =
      await fetchPgDjvuXml(
        volume,
      );


    const rawMatches =
      searchPages(
        xml,
        terms,
      );


    const volumeWorks =
      works.filter(
        (work) =>
          work.pgVolume ===
          volume,
      );


    const candidateWorkTitles =
      volumeWorks.map(
        (work) =>
          work.titleSr,
      );


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
          author.canonicalName,

        /*
         * Намерно не тврдимо још
         * да знамо тачно дело.
         * То ћемо утврдити
         * мапирањем PG колона.
         */
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
        /*
         * Пасус који има и ψυχ-
         * и θαν- иде испред пасуса
         * који има само један појам.
         */
        const scoreDifference =
          b.matchedTerms.length -
          a.matchedTerms.length;


        if (
          scoreDifference !==
          0
        ) {
          return scoreDifference;
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
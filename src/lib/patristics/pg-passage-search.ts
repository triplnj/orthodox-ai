import {
  findPatristicAuthor,
  findRelevantWorks,
} from "./corpus-index";


export type PgPassageMatch = {
  authorName: string;

  workTitle: string;

  pgVolume: number;

  pgColumns: string | null;

  queryTerms: string[];

  matchedTerm: string;

  originalText: string;

  contextText: string;

  sourceUrl: string;
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
      "ἀναστα",
      "αναστα",
    ],
  },

  {
    test:
      /ум\b|ума\b|mind|intellect|νοῦς|νους/iu,

    terms: [
      "νο",
    ],
  },

  {
    test:
      /љубав|love|ἀγάπ|αγαπ/iu,

    terms: [
      "ἀγαπ",
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


function archiveFullTextUrl(
  identifier: string,
) {
  return (
    `https://archive.org/download/${identifier}/` +
    `${identifier}_djvu.txt`
  );
}


async function fetchPgOcrText(
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
    archiveFullTextUrl(
      source.archiveIdentifier,
    );

  const response =
    await fetch(url, {
      headers: {
        "User-Agent":
          "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
      },

      next: {
        revalidate:
          60 * 60 * 24 * 30,
      },
    });


  if (!response.ok) {
    throw new Error(
      `Could not fetch OCR for PG ${volume}: ${response.status}`,
    );
  }


  const text =
    await response.text();


  return {
    text,

    sourceUrl:
      `https://archive.org/details/${source.archiveIdentifier}`,
  };
}


function splitIntoParagraphs(
  text: string,
) {
  return text
    .replace(/\r/g, "")
    .split(
      /\n\s*\n+/,
    )
    .map(
      (paragraph) =>
        paragraph
          .replace(
            /\s+/g,
            " ",
          )
          .trim(),
    )
    .filter(
      (paragraph) =>
        paragraph.length >=
        40,
    );
}


function findMatchingParagraphs(
  text: string,
  terms: string[],
  limit: number,
) {
  const paragraphs =
    splitIntoParagraphs(
      text,
    );


  const matches: {
    paragraph: string;

    matchedTerm: string;

    score: number;
  }[] = [];


  for (
    const paragraph of
    paragraphs
  ) {
    const normalized =
      normalizeGreek(
        paragraph,
      );

    let score = 0;

    let firstMatchedTerm =
      "";


    for (
      const term of terms
    ) {
      const normalizedTerm =
        normalizeGreek(
          term,
        );

      if (
        normalized.includes(
          normalizedTerm,
        )
      ) {
        score += 1;

        if (
          !firstMatchedTerm
        ) {
          firstMatchedTerm =
            term;
        }
      }
    }


    if (
      score === 0
    ) {
      continue;
    }


    matches.push({
      paragraph,

      matchedTerm:
        firstMatchedTerm,

      score,
    });
  }


  return matches
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(
      0,
      limit,
    );
}


function surroundingContext(
  text: string,
  paragraph: string,
) {
  const index =
    text.indexOf(
      paragraph,
    );


  if (
    index < 0
  ) {
    return paragraph;
  }


  const before =
    Math.max(
      0,
      index - 500,
    );

  const after =
    Math.min(
      text.length,
      index +
        paragraph.length +
        500,
    );


  return text
    .slice(
      before,
      after,
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


export async function searchPgPassages(
  query: string,
  limit = 10,
): Promise<PgPassageMatch[]> {
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


  const results:
    PgPassageMatch[] =
      [];


  for (
    const work of works
  ) {
    if (
      !work.pgVolume
    ) {
      continue;
    }


    const source =
      getPgVolumeSource(
        work.pgVolume,
      );


    if (!source) {
      continue;
    }


    const {
      text,
      sourceUrl,
    } =
      await fetchPgOcrText(
        work.pgVolume,
      );


    const matches =
      findMatchingParagraphs(
        text,
        terms,
        limit,
      );


    for (
      const match of
      matches
    ) {
      results.push({
        authorName:
          author.canonicalName,

        workTitle:
          work.titleSr,

        pgVolume:
          work.pgVolume,

        pgColumns:
          work.pgColumns ??
          null,

        queryTerms:
          terms,

        matchedTerm:
          match.matchedTerm,

        originalText:
          match.paragraph,

        contextText:
          surroundingContext(
            text,
            match.paragraph,
          ),

        sourceUrl,
      });
    }
  }


  return results
    .slice(
      0,
      limit,
    );
}
export type CuratedPatristicDocument = {
  key: string;

  authorName: string;

  authorAliases: string[];

  workTitle: string;

  workAliases: string[];

  sourceUrl: string;

  sourceName: string;

  sourceLanguage: string;

  documentType:
    | "PRIMARY_TEXT"
    | "TRANSLATION"
    | "BIBLIOGRAPHIC";

  verificationStatus: string;
};

export const CURATED_PATRISTIC_DOCUMENTS:
  CuratedPatristicDocument[] = [
    {
      key:
        "isaac-nineveh-mystic-treatises-wensinck",

      authorName:
        "St. Isaac the Syrian",

      authorAliases: [
        "isaac the syrian",
        "st isaac the syrian",
        "saint isaac the syrian",
        "isaac of nineveh",
        "isaac the syrian of nineveh",
        "isak sirin",
        "sveti isak sirin",
        "исак сирин",
        "свети исак сирин",
        "isaak der syrer",
        "heiliger isaak der syrer",
      ],

      workTitle:
        "Mystic Treatises / Ascetical Homilies",

      workAliases: [
        "mystic treatises",
        "ascetical homilies",
        "ascetical works",
        "podviznicke besede",
        "podvižničke besede",
        "аскетске беседе",
        "подвижничке беседе",
        "asketische homilien",
      ],

      sourceUrl:
        "https://www.atour.com/media/files/library/religion/Isaac_of_Nineveh_-_Mystical_Treatises_-_AJWensinck.pdf",

      sourceName:
        "A. J. Wensinck, Mystic Treatises by Isaac of Nineveh (1923)",

      sourceLanguage:
        "English",

      documentType:
        "TRANSLATION",

      verificationStatus:
        "CURATED_PUBLIC_DOMAIN_EDITION",
    },

    {
      key:
        "isaac-nineveh-syriac-bibliography",

      authorName:
        "St. Isaac the Syrian",

      authorAliases: [
        "isaac the syrian",
        "st isaac the syrian",
        "saint isaac the syrian",
        "isaac of nineveh",
        "isak sirin",
        "sveti isak sirin",
        "исак сирин",
        "свети исак сирин",
        "isaak der syrer",
        "heiliger isaak der syrer",
      ],

      workTitle:
        "Ascetical Discourses",

      workAliases: [
        "ascetical homilies",
        "ascetical discourses",
        "ascetical works",
        "mystic treatises",
        "аскетске беседе",
        "подвижничке беседе",
        "asketische homilien",
      ],

      sourceUrl:
        "https://syri.ac/authors-jacob-sarug/isaac-nineveh-discourses",

      sourceName:
        "syri.ac — Isaac of Nineveh: Discourses",

      sourceLanguage:
        "English",

      documentType:
        "BIBLIOGRAPHIC",

      verificationStatus:
        "CURATED_SCHOLARLY_BIBLIOGRAPHY",
    },

    {
      key:
        "isaac-nineveh-gorgias-bibliography",

      authorName:
        "St. Isaac the Syrian",

      authorAliases: [
        "isaac the syrian",
        "st isaac the syrian",
        "saint isaac the syrian",
        "isaac of nineveh",
        "isak sirin",
        "sveti isak sirin",
        "исак сирин",
        "свети исак сирин",
        "isaak der syrer",
        "heiliger isaak der syrer",
      ],

      workTitle:
        "The Ascetical Homilies of Mar Isaac of Nineveh",

      workAliases: [
        "ascetical homilies",
        "ascetical discourses",
        "ascetical works",
        "mystic treatises",
        "аскетске беседе",
        "подвижничке беседе",
        "asketische homilien",
      ],

      sourceUrl:
        "https://www.gorgiaspress.com/the-ascetical-homilies-of-mar-isaac-of-nineveh",

      sourceName:
        "Gorgias Press — The Ascetical Homilies of Mar Isaac of Nineveh",

      sourceLanguage:
        "English",

      documentType:
        "BIBLIOGRAPHIC",

      verificationStatus:
        "CURATED_SCHOLARLY_BIBLIOGRAPHY",
    },

    {
      key:
        "john-damascus-orthodox-faith-book-iv",

      authorName:
        "St. John of Damascus",

      authorAliases: [
        "john of damascus",
        "john damascene",
        "st john of damascus",
        "saint john of damascus",
        "jovan damaskin",
        "sveti jovan damaskin",
        "јован дамаскин",
        "свети јован дамаскин",
        "johannes von damaskus",
        "heiliger johannes von damaskus",
      ],

      workTitle:
        "An Exposition of the Orthodox Faith, Book IV",

      workAliases: [
        "exposition of the orthodox faith",
        "orthodox faith",
        "de fide orthodoxa",
        "тачно изложење православне вере",
        "tacno izlozenje pravoslavne vere",
        "genaue darlegung des orthodoxen glaubens",
      ],

      sourceUrl:
        "https://www.newadvent.org/fathers/33044.htm",

      sourceName:
        "New Advent — John of Damascus, Exposition of the Orthodox Faith, Book IV",

      sourceLanguage:
        "English",

      documentType:
        "TRANSLATION",

      verificationStatus:
        "CURATED_PATRISTIC_TEXT_REPOSITORY",
    },
  ];

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
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function findCuratedPatristicDocuments(
  query: string,
) {
  const normalizedQuery =
    normalize(query);

  return CURATED_PATRISTIC_DOCUMENTS.filter(
    (document) => {
      const authorMatch =
        document.authorAliases.some(
          (alias) =>
            normalizedQuery.includes(
              normalize(alias),
            ),
        );

      const workMatch =
        document.workAliases.some(
          (alias) =>
            normalizedQuery.includes(
              normalize(alias),
            ),
        );

      return (
        authorMatch ||
        workMatch
      );
    },
  );
}

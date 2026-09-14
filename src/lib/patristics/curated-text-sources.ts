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

  /*
   * Optional Wikisource collection prefix.
   *
   * When present, retrieval uses the MediaWiki API
   * to locate relevant child pages inside this
   * specific work instead of downloading one large
   * PDF at request time.
   */
  wikisourceTitlePrefix?: string;
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
        "https://en.wikisource.org/wiki/Mystic_Treatises",

      sourceName:
        "Wikisource — A. J. Wensinck, Mystic Treatises by Isaac of Nineveh (1923)",

      wikisourceTitlePrefix:
        "Mystic Treatises/",

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
        "john-damascus-holy-images-greek",

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
        "Περὶ εἰκόνων / Apologetic Treatises against those who decry the holy images",

      workAliases: [
        "икона",
        "иконе",
        "иконама",
        "теологија иконе",
        "icon",
        "icons",
        "image",
        "images",
        "holy images",
        "divine images",
        "peri eikonon",
        "περι εικονων",
        "περὶ εἰκόνων",
        "иконоборство",
        "iconoclasm",
      ],

      sourceUrl:
        "https://www.vlioras.gr/Philologia/History/Byzantine/Texts/Damaskinos_Peri_Eikonon.htm",

      sourceName:
        "Greek primary text — John of Damascus, Περὶ εἰκόνων",

      sourceLanguage:
        "Greek",

      documentType:
        "PRIMARY_TEXT",

      verificationStatus:
        "CURATED_PRIMARY_TEXT",
    },

    {
      key:
        "john-damascus-holy-images-gutenberg",

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
        "St John Damascene on Holy Images",

      workAliases: [
        "икона",
        "иконе",
        "иконама",
        "теологија иконе",
        "icon",
        "icons",
        "image",
        "images",
        "holy images",
        "divine images",
        "иконоборство",
        "iconoclasm",
      ],

      sourceUrl:
        "https://www.gutenberg.org/cache/epub/49917/pg49917-images.html",

      sourceName:
        "Project Gutenberg — Mary H. Allies, St John Damascene on Holy Images (1898)",

      sourceLanguage:
        "English",

      documentType:
        "TRANSLATION",

      verificationStatus:
        "CURATED_PUBLIC_DOMAIN_EDITION",
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

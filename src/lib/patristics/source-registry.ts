export type VerificationSource = {
  url: string;
  name: string;
  sourceType: string;
};

export type PatristicWorkSource = {
  key: string;

  authorNames: string[];
  workTitles: string[];

  verificationSources: VerificationSource[];
};


export const PATRISTIC_SOURCE_REGISTRY:
  PatristicWorkSource[] = [
  {
    key: "john-climacus-ladder",

    authorNames: [
      "John Climacus",
      "St John Climacus",
      "Saint John Climacus",
      "John of Sinai",
      "Ιωάννης της Κλίμακος",
      "Ἰωάννης ὁ Σιναΐτης",
    ],

    workTitles: [
      "Scala Paradisi",
      "The Ladder of Divine Ascent",
      "Ladder of Divine Ascent",
      "The Ladder",
      "Κλίμαξ",
    ],

    verificationSources: [
      {
        url:
          "https://remacle.org/bloodwolf/eglise/climaque/escalier7.htm",

        name:
          "Remacle — Ladder Step 26, Part 1",

        sourceType:
          "INDEPENDENT_GREEK_TRANSCRIPTION",
      },

      {
        url:
          "https://remacle.org/bloodwolf/eglise/climaque/escalier8.htm",

        name:
          "Remacle — Ladder Step 26, Part 2",

        sourceType:
          "INDEPENDENT_GREEK_TRANSCRIPTION",
      },
    ],
  },
];


function normalize(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


export function findWorkSources(
  authorName: string,
  workTitle: string,
) {
  const author =
    normalize(authorName);

  const work =
    normalize(workTitle);


  return (
    PATRISTIC_SOURCE_REGISTRY.find(
      (entry) => {
        const authorMatch =
          entry.authorNames.some(
            (name) =>
              normalize(name) === author,
          );

        const workMatch =
          entry.workTitles.some(
            (title) =>
              normalize(title) === work,
          );

        return (
          authorMatch &&
          workMatch
        );
      },
    ) ?? null
  );
}
export type TrustedPatristicSource = {
  domain: string;
  name: string;
  sourceType: string;
  trustLevel: number;
};

export const TRUSTED_PATRISTIC_SOURCES:
  TrustedPatristicSource[] = [
  {
    domain: "el.wikisource.org",
    name: "Greek Wikisource",
    sourceType: "PRIMARY_TEXT_REPOSITORY",
    trustLevel: 90,
  },

  {
    domain: "azbyka.ru",
    name: "Azbyka",
    sourceType: "ORTHODOX_TEXT_LIBRARY",
    trustLevel: 90,
  },

  {
    domain: "pravoslavie.ru",
    name: "Pravoslavie.ru",
    sourceType: "ORTHODOX_PUBLISHER",
    trustLevel: 85,
  },

  {
    domain: "doxologia.ro",
    name: "Doxologia",
    sourceType: "ORTHODOX_CHURCH_PUBLISHER",
    trustLevel: 90,
  },

  {
    domain: "svetigora.com",
    name: "Svetigora",
    sourceType: "ORTHODOX_CHURCH_PUBLISHER",
    trustLevel: 90,
  },

  {
    domain: "svetosavlje.org",
    name: "Svetosavlje",
    sourceType: "ORTHODOX_TEXT_LIBRARY",
    trustLevel: 85,
  },

  {
    domain: "churchofcyprus.org.cy",
    name: "Church of Cyprus",
    sourceType: "OFFICIAL_ORTHODOX_CHURCH",
    trustLevel: 100,
  },

  {
    domain: "agiooros.org",
    name: "Agiooros",
    sourceType: "ORTHODOX_TEXT_REPOSITORY",
    trustLevel: 85,
  },

  {
    domain: "newadvent.org",
    name: "New Advent",
    sourceType: "PATRISTIC_TEXT_REPOSITORY",
    trustLevel: 80,
  },

  {
    domain: "orthodoxchurchfathers.com",
    name: "Orthodox Church Fathers",
    sourceType: "PATRISTIC_TEXT_REPOSITORY",
    trustLevel: 80,
  },
];

export function findTrustedPatristicSource(
  url: string,
): TrustedPatristicSource | null {
  try {
    const hostname =
      new URL(url)
        .hostname
        .toLowerCase()
        .replace(/^www\./, "");

    return (
      TRUSTED_PATRISTIC_SOURCES.find(
        (source) =>
          hostname === source.domain ||
          hostname.endsWith(
            `.${source.domain}`,
          ),
      ) ?? null
    );
  } catch {
    return null;
  }
}
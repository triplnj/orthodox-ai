export type AuthoritativeCorpus =
  | "SCRIPTURE"
  | "PATROLOGIA_GRAECA"
  | "PHILOKALIA";


export type AuthoritativeSource = {
  corpus: AuthoritativeCorpus;
  name: string;
  description: string;
  baseUrl: string;
  domains: string[];
};


export const AUTHORITATIVE_SOURCES:
  AuthoritativeSource[] = [
    {
      corpus: "SCRIPTURE",

      name: "Holy Scripture",

      description:
        "Canonical books of Holy Scripture.",

      baseUrl:
        "https://www.biblegateway.com/",

      domains: [
        "biblegateway.com",
        "www.biblegateway.com",
      ],
    },

    {
      corpus:
        "PATROLOGIA_GRAECA",

      name:
        "Patrologia Graeca",

      description:
        "J.-P. Migne, Patrologiae Cursus Completus, Series Graeca.",

      baseUrl:
        "https://onlinebooks.library.upenn.edu/webbin/book/lookupid?key=olbp89086",

      domains: [
        "onlinebooks.library.upenn.edu",
        "archive.org",
        "www.archive.org",
        "el.wikisource.org",
        "la.wikisource.org",
        "commons.wikimedia.org",
        "patrologiagraeca.org",
        "www.patrologiagraeca.org",
      ],
    },

    {
      corpus:
        "PHILOKALIA",

      name:
        "The Philokalia",

      description:
        "The Philokalia corpus of ascetic and hesychast writings.",

      baseUrl:
        "https://philokalia.com/",

      domains: [
        "philokalia.com",
        "www.philokalia.com",
      ],
    },
  ];


export function normalizeHostname(
  value: string,
) {
  try {
    return new URL(value)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return value
      .toLowerCase()
      .replace(/^www\./, "");
  }
}


export function findAuthoritativeSource(
  url: string,
) {
  const hostname =
    normalizeHostname(url);

  return (
    AUTHORITATIVE_SOURCES.find(
      (source) =>
        source.domains.some(
          (domain) =>
            normalizeHostname(
              domain,
            ) === hostname,
        ),
    ) ?? null
  );
}


export function isAuthoritativeSource(
  url: string,
) {
  return Boolean(
    findAuthoritativeSource(url),
  );
}


export function getAuthoritativeCorpus(
  url: string,
):
  | AuthoritativeCorpus
  | null {
  return (
    findAuthoritativeSource(url)
      ?.corpus ?? null
  );
}
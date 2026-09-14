export type PgVolumeSource = {
  volume: number;

  archiveIdentifier: string;

  djvuXmlUrl: string;

  detailsUrl: string;
};


type PgVolumeSourceCandidate = {
  archiveIdentifier: string;
};


/*
 * Internet Archive identifikatori
 * NISU numerisani pouzdano prema
 * PG broju toma.
 *
 * Zato ovde držimo deterministički
 * katalog poznatih digitalnih kopija.
 *
 * Kasnije ovaj katalog možemo
 * proširiti na svih 161 tomova.
 */
const PG_VOLUME_SOURCE_CATALOG:
  Record<
    number,
    PgVolumeSourceCandidate[]
  > = {
    41: [
      {
        archiveIdentifier:
          "patrologiaecurs30hopfgoog",
      },

      {
        archiveIdentifier:
          "patrologiaecurs126migngoog",
      },
    ],

    42: [
      {
        archiveIdentifier:
          "patrologiaecurs12hopfgoog",
      },
    ],

    /*
     * PG 46 nam je već radio
     * u prethodnom prototipu.
     */
    46: [
      {
        archiveIdentifier:
          "patrologiaecursu46mignuoft",
      },
    ],
  };


const sourceCache =
  new Map<
    number,
    PgVolumeSource | null
  >();


function isValidPgVolume(
  volume: number,
) {
  return (
    Number.isInteger(volume) &&
    volume >= 1 &&
    volume <= 161
  );
}


function buildSource(
  volume: number,
  archiveIdentifier: string,
): PgVolumeSource {
  return {
    volume,

    archiveIdentifier,

    djvuXmlUrl:
      `https://archive.org/download/${archiveIdentifier}/${archiveIdentifier}_djvu.xml`,

    detailsUrl:
      `https://archive.org/details/${archiveIdentifier}`,
  };
}


async function sourceExists(
  source: PgVolumeSource,
): Promise<boolean> {
  /*
   * Neki IA fajlovi ne odgovaraju
   * pravilno na HEAD, pa prvo
   * pokušavamo HEAD, a zatim mali
   * GET zahtev.
   */
  try {
    const headResponse =
      await fetch(
        source.djvuXmlUrl,
        {
          method: "HEAD",

          redirect: "follow",

          cache: "no-store",
        },
      );


    if (
      headResponse.ok
    ) {
      return true;
    }


    /*
     * 403/405 ili drugi server-side
     * problem ne mora značiti da
     * fajl ne postoji.
     */
  } catch {
    // fallback below
  }


  try {
    const response =
      await fetch(
        source.djvuXmlUrl,
        {
          method: "GET",

          headers: {
            Range:
              "bytes=0-1023",
          },

          redirect: "follow",

          cache: "no-store",
        },
      );


    return (
      response.ok ||
      response.status === 206
    );
  } catch {
    return false;
  }
}


function buildFallbackIdentifiers(
  volume: number,
): string[] {
  const raw =
    String(volume);

  const padded =
    String(volume)
      .padStart(
        3,
        "0",
      );


  return [
    /*
     * Stari Toronto/OFT pattern.
     *
     * Ne smatramo ga pouzdanim,
     * ali može pogoditi neke tomove.
     */
    `patrologiaecursu${raw}mignuoft`,

    `patrologiaecursu${padded}mignuoft`,

    /*
     * Postoje i kolekcije sa
     * jednostavnijim nazivima.
     */
    `Patrologia_Graeca_vol_${padded}`,

    `patrologiagraeca${raw}`,
  ];
}


function uniqueStrings(
  values: string[],
) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}


type ArchiveSearchDoc = {
  identifier?: string;
  title?: string;
  description?: string;
};


function textContainsPgVolume(
  value: string,
  volume: number,
) {
  const normalized =
    value.toLowerCase();

  const patterns = [
    `vol. ${volume}`,
    `vol ${volume}`,
    `volume ${volume}`,
    `tomus ${volume}`,
    `tome ${volume}`,
    `t. ${volume}`,
  ];

  return patterns.some(
    (pattern) =>
      normalized.includes(
        pattern,
      ),
  );
}


async function discoverArchiveIdentifiers(
  volume: number,
): Promise<string[]> {
  const queries = [
    `"Patrologia Graeca" AND "${volume}" AND mediatype:texts`,
    `"Patrologiae cursus completus" AND "Series Graeca" AND "${volume}" AND mediatype:texts`,
    `"Migne" AND "Patrologia" AND "${volume}" AND mediatype:texts`,
  ];

  const identifiers: string[] =
    [];

  for (const query of queries) {
    try {
      const url =
        new URL(
          "https://archive.org/advancedsearch.php",
        );

      url.searchParams.set(
        "q",
        query,
      );
      url.searchParams.append(
        "fl[]",
        "identifier",
      );
      url.searchParams.append(
        "fl[]",
        "title",
      );
      url.searchParams.append(
        "fl[]",
        "description",
      );
      url.searchParams.set(
        "rows",
        "50",
      );
      url.searchParams.set(
        "page",
        "1",
      );
      url.searchParams.set(
        "output",
        "json",
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
                60 * 60 * 24 * 30,
            },
          },
        );

      if (!response.ok) {
        continue;
      }

      const data =
        await response.json() as {
          response?: {
            docs?: ArchiveSearchDoc[];
          };
        };

      for (
        const doc of
        data.response?.docs ?? []
      ) {
        if (!doc.identifier) {
          continue;
        }

        const searchable =
          [
            doc.title ?? "",
            doc.description ?? "",
            doc.identifier,
          ].join(" ");

        if (
          textContainsPgVolume(
            searchable,
            volume,
          )
        ) {
          identifiers.push(
            doc.identifier,
          );
        }
      }
    } catch {
      continue;
    }
  }

  return uniqueStrings(
    identifiers,
  );
}


async function sourceHasDjvuXml(
  volume: number,
  identifier: string,
): Promise<
  PgVolumeSource | null
> {
  try {
    const metadataResponse =
      await fetch(
        `https://archive.org/metadata/${identifier}`,
        {
          headers: {
            "User-Agent":
              "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
          },

          next: {
            revalidate:
              60 * 60 * 24 * 30,
          },
        },
      );

    if (!metadataResponse.ok) {
      return null;
    }

    const metadata =
      await metadataResponse.json() as {
        files?: Array<{
          name?: string;
          format?: string;
        }>;
      };

    const djvuXml =
      metadata.files?.find(
        (file) =>
          Boolean(
            file.name?.endsWith(
              "_djvu.xml",
            ),
          ) ||
          file.format ===
            "DjVu XML",
      );

    if (!djvuXml?.name) {
      return null;
    }

    return {
      volume,
      archiveIdentifier:
        identifier,
      djvuXmlUrl:
        `https://archive.org/download/${identifier}/${encodeURIComponent(djvuXml.name)}`,
      detailsUrl:
        `https://archive.org/details/${identifier}`,
    };
  } catch {
    return null;
  }
}


export async function resolvePgVolumeSource(
  volume: number,
): Promise<
  PgVolumeSource | null
> {
  if (
    !isValidPgVolume(
      volume,
    )
  ) {
    return null;
  }


  /*
   * Ne ponavljamo mrežne provere
   * tokom istog procesa.
   */
  if (
    sourceCache.has(
      volume,
    )
  ) {
    return (
      sourceCache.get(
        volume,
      ) ??
      null
    );
  }


  /*
   * 1.
   * Prvo koristimo deterministički
   * katalog poznatih kopija.
   */
  const catalogCandidates =
    PG_VOLUME_SOURCE_CATALOG[
      volume
    ] ?? [];


  /*
   * 2.
   * Probamo poznate i generičke identifikatore.
   */
  const initialIdentifiers =
    uniqueStrings([
      ...catalogCandidates.map(
        (candidate) =>
          candidate.archiveIdentifier,
      ),

      ...buildFallbackIdentifiers(
        volume,
      ),
    ]);


  for (
    const identifier of
    initialIdentifiers
  ) {
    const source =
      buildSource(
        volume,
        identifier,
      );


    const exists =
      await sourceExists(
        source,
      );


    if (exists) {
      sourceCache.set(
        volume,
        source,
      );


      return source;
    }
  }


  /*
   * 3.
   * Ako poznati obrasci ne rade, dinamički
   * pretražujemo Internet Archive metadata.
   *
   * Kandidat prihvatamo samo ako metadata API
   * potvrdi da item stvarno ima DjVu XML OCR.
   */
  const discoveredIdentifiers =
    await discoverArchiveIdentifiers(
      volume,
    );


  for (
    const identifier of
    discoveredIdentifiers
  ) {
    const source =
      await sourceHasDjvuXml(
        volume,
        identifier,
      );


    if (source) {
      sourceCache.set(
        volume,
        source,
      );


      return source;
    }
  }


  sourceCache.set(
    volume,
    null,
  );


  return null;
}
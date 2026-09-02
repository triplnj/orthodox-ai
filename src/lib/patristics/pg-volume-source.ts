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
   * Tek nakon toga probamo
   * generičke fallback obrasce.
   */
  const identifiers =
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
    identifiers
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


  sourceCache.set(
    volume,
    null,
  );


  return null;
}
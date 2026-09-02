export type PgVolumeSource = {
  volume: number;

  archiveIdentifier: string;

  djvuXmlUrl: string;

  detailsUrl: string;
};


const sourceCache =
  new Map<
    number,
    PgVolumeSource | null
  >();


function candidateIdentifiers(
  volume: number,
) {
  const padded =
    String(volume).padStart(
      3,
      "0",
    );


  /*
   * Internet Archive nema uvek
   * potpuno isti obrazac naziva.
   *
   * Zato ne vezujemo sistem za
   * samo jedan pretpostavljeni ID.
   */
  return [
    `patrologiaecursu${volume}mignuoft`,

    `patrologiaecursu${padded}mignuoft`,
  ];
}


function djvuXmlUrl(
  identifier: string,
) {
  return (
    `https://archive.org/download/${identifier}/` +
    `${identifier}_djvu.xml`
  );
}


function detailsUrl(
  identifier: string,
) {
  return (
    `https://archive.org/details/${identifier}`
  );
}


async function identifierExists(
  identifier: string,
) {
  const url =
    djvuXmlUrl(
      identifier,
    );


  try {
    const response =
      await fetch(
        url,
        {
          method:
            "HEAD",

          headers: {
            "User-Agent":
              "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
          },

          cache:
            "no-store",
        },
      );


    /*
     * Neki IA endpointi ne vole HEAD.
     * Ako HEAD uspe — dovoljno.
     */
    if (
      response.ok
    ) {
      return true;
    }


    /*
     * Ako server odbija HEAD,
     * radimo mali GET kao proveru.
     */
    if (
      response.status ===
        405 ||
      response.status ===
        403
    ) {
      const getResponse =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Range:
                "bytes=0-32",

              "User-Agent":
                "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
            },

            cache:
              "no-store",
          },
        );


      return (
        getResponse.ok ||
        getResponse.status ===
          206
      );
    }


    return false;
  } catch {
    return false;
  }
}


export async function resolvePgVolumeSource(
  volume: number,
): Promise<
  PgVolumeSource | null
> {
  if (
    !Number.isInteger(
      volume,
    ) ||
    volume < 1 ||
    volume > 161
  ) {
    return null;
  }


  if (
    sourceCache.has(
      volume,
    )
  ) {
    return (
      sourceCache.get(
        volume,
      ) ?? null
    );
  }


  const identifiers =
    candidateIdentifiers(
      volume,
    );


  for (
    const identifier of
    identifiers
  ) {
    const exists =
      await identifierExists(
        identifier,
      );


    if (!exists) {
      continue;
    }


    const source:
      PgVolumeSource = {
        volume,

        archiveIdentifier:
          identifier,

        djvuXmlUrl:
          djvuXmlUrl(
            identifier,
          ),

        detailsUrl:
          detailsUrl(
            identifier,
          ),
      };


    sourceCache.set(
      volume,
      source,
    );


    return source;
  }


  sourceCache.set(
    volume,
    null,
  );


  return null;
}
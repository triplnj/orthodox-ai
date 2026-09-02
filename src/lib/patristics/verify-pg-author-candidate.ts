import {
  findPgAuthorCatalogEntry,
} from "./pg-author-catalog";

import {
  resolvePgVolumeSource,
} from "./pg-volume-source";

import type {
  ResolvedPgAuthor,
} from "./resolve-pg-author";


export type VerifiedPgAuthorCandidate = {
  canonicalName: string;

  latinName: string | null;

  greekName: string | null;

  /*
   * Bibliografski potvrđeni PG
   * tomovi autora.
   */
  pgVolumes: number[];

  /*
   * Tomovi za koje smo trenutno
   * uspeli da pronađemo digitalni
   * OCR source.
   */
  availablePgVolumes: number[];

  /*
   * Bibliografski validni tomovi
   * za koje digitalni resolver
   * trenutno nije našao source.
   */
  unavailablePgVolumes: number[];

  source:
    | "LOCAL_INDEX"
    | "AI_CANDIDATE";

  /*
   * Da li znamo dovoljno pouzdano
   * kome treba rutirati upit.
   */
  routingVerified: boolean;

  /*
   * Da li je veza:
   *
   * autor -> PG tomovi
   *
   * deterministički potvrđena,
   * a ne samo AI pretpostavka.
   */
  authorVolumeVerified: boolean;
};


function uniqueNumbers(
  values: number[],
): number[] {
  return [
    ...new Set(
      values.filter(
        (value) =>
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 161,
      ),
    ),
  ].sort(
    (a, b) =>
      a - b,
  );
}


async function checkDigitalSources(
  volumes: number[],
): Promise<{
  available: number[];
  unavailable: number[];
}> {
  const available: number[] = [];
  const unavailable: number[] = [];

  for (const volume of volumes) {
    try {
      const source =
        await resolvePgVolumeSource(
          volume,
        );

      if (source) {
        available.push(volume);
      } else {
        unavailable.push(volume);
      }
    } catch {
      unavailable.push(volume);
    }
  }

  return {
    available:
      uniqueNumbers(available),

    unavailable:
      uniqueNumbers(unavailable),
  };
}


export async function verifyPgAuthorCandidate(
  candidate: ResolvedPgAuthor,
): Promise<VerifiedPgAuthorCandidate> {
  /*
   * ------------------------------------------------
   * 1. Lokalni indeks
   * ------------------------------------------------
   *
   * Ako je autor već u našem
   * kontrolisanom corpus-index.ts,
   * njegovi PG tomovi se smatraju
   * bibliografski potvrđenim.
   */
  if (
    candidate.source ===
    "LOCAL_INDEX"
  ) {
    const pgVolumes =
      uniqueNumbers(
        candidate.pgVolumes,
      );

    const digital =
      await checkDigitalSources(
        pgVolumes,
      );

    return {
      canonicalName:
        candidate.canonicalName,

      latinName:
        candidate.latinName,

      greekName:
        candidate.greekName,

      pgVolumes,

      availablePgVolumes:
        digital.available,

      unavailablePgVolumes:
        digital.unavailable,

      source:
        candidate.source,

      routingVerified:
        pgVolumes.length > 0,

      authorVolumeVerified:
        pgVolumes.length > 0,
    };
  }


  /*
   * ------------------------------------------------
   * 2. AI kandidat
   * ------------------------------------------------
   *
   * AI je dozvoljeno da kaže:
   *
   * "Mislim da je ovo Epifanije."
   *
   * Ali AI PG tomovi se NE
   * prihvataju kao dokaz.
   *
   * Autor se mora pronaći u našem
   * determinističkom PG katalogu.
   */
  let catalogEntry =
    findPgAuthorCatalogEntry(
      candidate.canonicalName,
    );


  if (
    !catalogEntry &&
    candidate.latinName
  ) {
    catalogEntry =
      findPgAuthorCatalogEntry(
        candidate.latinName,
      );
  }


  if (
    !catalogEntry &&
    candidate.greekName
  ) {
    catalogEntry =
      findPgAuthorCatalogEntry(
        candidate.greekName,
      );
  }


  /*
   * Autor nije potvrđen
   * determinističkim katalogom.
   *
   * Zato ne koristimo AI PG
   * brojeve za produkcioni routing.
   */
  if (!catalogEntry) {
    return {
      canonicalName:
        candidate.canonicalName,

      latinName:
        candidate.latinName,

      greekName:
        candidate.greekName,

      pgVolumes: [],

      availablePgVolumes: [],

      unavailablePgVolumes: [],

      source:
        candidate.source,

      routingVerified:
        false,

      authorVolumeVerified:
        false,
    };
  }


  /*
   * ------------------------------------------------
   * 3. Autor je pronađen u katalogu
   * ------------------------------------------------
   *
   * Ovo su sada bibliografski
   * potvrđeni PG tomovi.
   */
  const pgVolumes =
    uniqueNumbers(
      catalogEntry.pgVolumes,
    );


  /*
   * ------------------------------------------------
   * 4. Digitalna dostupnost
   * ------------------------------------------------
   *
   * Ovo je potpuno odvojena stvar.
   *
   * Ako Internet Archive/OCR
   * resolver ne pronađe neki tom,
   * taj tom NE nestaje iz
   * pgVolumes.
   */
  const digital =
    await checkDigitalSources(
      pgVolumes,
    );


  return {
    canonicalName:
      catalogEntry.canonicalName,

    latinName:
      candidate.latinName,

    greekName:
      candidate.greekName,

    pgVolumes,

    availablePgVolumes:
      digital.available,

    unavailablePgVolumes:
      digital.unavailable,

    source:
      candidate.source,

    /*
     * Autor je deterministički
     * pronađen u našem katalogu.
     */
    routingVerified:
      pgVolumes.length > 0,

    /*
     * Veza autor -> PG tom je
     * potvrđena katalogom.
     */
    authorVolumeVerified:
      pgVolumes.length > 0,
  };
}
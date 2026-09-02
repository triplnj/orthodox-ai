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

  pgVolumes: number[];

  availablePgVolumes: number[];

  unavailablePgVolumes: number[];

  source:
    | "LOCAL_INDEX"
    | "AI_CANDIDATE";

  routingVerified: boolean;

  authorVolumeVerified: boolean;
};


export async function verifyPgAuthorCandidate(
  candidate: ResolvedPgAuthor,
): Promise<
  VerifiedPgAuthorCandidate
> {
  const availablePgVolumes:
    number[] = [];

  const unavailablePgVolumes:
    number[] = [];


  /*
   * Proveravamo svaki predloženi
   * PG tom preko stvarnog resolvera.
   *
   * Time dokazujemo da postoji
   * upotrebljiv digitalni PG izvor.
   */
  for (
    const volume of
    candidate.pgVolumes
  ) {
    try {
      const source =
        await resolvePgVolumeSource(
          volume,
        );


      if (source) {
        availablePgVolumes.push(
          volume,
        );
      } else {
        unavailablePgVolumes.push(
          volume,
        );
      }
    } catch {
      unavailablePgVolumes.push(
        volume,
      );
    }
  }


  /*
   * LOCAL_INDEX:
   *
   * autor -> PG tom veza dolazi
   * iz našeg kontrolisanog indeksa.
   *
   * AI_CANDIDATE:
   *
   * trenutno smo proverili samo
   * da predloženi PG tom postoji
   * i da možemo da mu pristupimo.
   *
   * Još NISMO nezavisno dokazali
   * da taj tom pripada baš tom
   * autoru.
   */
  const authorVolumeVerified =
    candidate.source ===
      "LOCAL_INDEX" &&
    availablePgVolumes.length >
      0;


  return {
    canonicalName:
      candidate.canonicalName,

    latinName:
      candidate.latinName,

    greekName:
      candidate.greekName,

    pgVolumes:
      candidate.pgVolumes,

    availablePgVolumes,

    unavailablePgVolumes,

    source:
      candidate.source,

    routingVerified:
      availablePgVolumes.length >
      0,

    authorVolumeVerified,
  };
}
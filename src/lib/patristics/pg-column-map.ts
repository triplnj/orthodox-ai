export type PgColumnReference = {
  pgVolume: number;

  scanPage: number;

  pgFirstColumn:
    | number
    | null;

  pgSecondColumn:
    | number
    | null;

  pgReference:
    | string
    | null;

  mapped: boolean;
};


type PgVolumeAnchor = {
  pgVolume: number;

  scanPage: number;

  firstColumn: number;

  columnsPerScanPage: number;
};


/*
 * Ovde čuvamo samo PROVERENE
 * anchor-e.
 *
 * Ne dodajemo tom dok ne znamo
 * pouzdano odnos:
 *
 * scan page -> PG column.
 *
 * PG 46 je već proveravan tokom
 * našeg prototipa.
 */
const PG_VOLUME_ANCHORS:
  PgVolumeAnchor[] = [
    {
      pgVolume: 46,

      scanPage: 13,

      firstColumn: 11,

      columnsPerScanPage: 2,
    },
  ];


function findAnchor(
  pgVolume: number,
) {
  return (
    PG_VOLUME_ANCHORS.find(
      (anchor) =>
        anchor.pgVolume ===
        pgVolume,
    ) ?? null
  );
}


export function mapScanPageToPgColumns(
  pgVolume: number,
  scanPage: number,
): PgColumnReference {
  const anchor =
    findAnchor(
      pgVolume,
    );


  /*
   * Ako nemamo pouzdan anchor,
   * NE izmišljamo PG kolonu.
   */
  if (!anchor) {
    return {
      pgVolume,

      scanPage,

      pgFirstColumn:
        null,

      pgSecondColumn:
        null,

      pgReference:
        null,

      mapped:
        false,
    };
  }


  const pageDifference =
    scanPage -
    anchor.scanPage;


  const firstColumn =
    anchor.firstColumn +
    pageDifference *
      anchor.columnsPerScanPage;


  /*
   * Ako scan vodi pre početka
   * stvarnog PG teksta,
   * rezultat nije validan.
   */
  if (
    firstColumn <
    1
  ) {
    return {
      pgVolume,

      scanPage,

      pgFirstColumn:
        null,

      pgSecondColumn:
        null,

      pgReference:
        null,

      mapped:
        false,
    };
  }


  const secondColumn =
    firstColumn +
    anchor.columnsPerScanPage -
    1;


  return {
    pgVolume,

    scanPage,

    pgFirstColumn:
      firstColumn,

    pgSecondColumn:
      secondColumn,

    pgReference:
      secondColumn ===
      firstColumn
        ? `PG ${pgVolume}, col. ${firstColumn}`
        : `PG ${pgVolume}, cols. ${firstColumn}–${secondColumn}`,

    mapped:
      true,
  };
}
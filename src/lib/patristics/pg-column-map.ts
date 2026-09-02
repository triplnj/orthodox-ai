export type PgColumnLocation = {
  pgVolume: number;

  scanPage: number;

  firstColumn: number | null;

  secondColumn: number | null;
};


/*
 * За PG 46, De anima et resurrectione
 * почиње у PG col. 11.
 *
 * У нашем Internet Archive примерку
 * scan page 13 је прва страница
 * самог текста тог дела.
 *
 * PG штампа има по две колоне
 * на једној скенираној страници.
 */
const PG_46_KNOWN_ANCHORS = [
  {
    scanPage: 13,

    firstColumn: 11,
  },
];


function findNearestAnchor(
  scanPage: number,
) {
  return (
    [...PG_46_KNOWN_ANCHORS]
      .filter(
        (anchor) =>
          anchor.scanPage <=
          scanPage,
      )
      .sort(
        (a, b) =>
          b.scanPage -
          a.scanPage,
      )[0] ?? null
  );
}


export function mapPg46ScanPageToColumns(
  scanPage: number,
): PgColumnLocation {
  const anchor =
    findNearestAnchor(
      scanPage,
    );


  if (!anchor) {
    return {
      pgVolume: 46,

      scanPage,

      firstColumn: null,

      secondColumn: null,
    };
  }


  const pageOffset =
    scanPage -
    anchor.scanPage;


  const firstColumn =
    anchor.firstColumn +
    pageOffset * 2;


  return {
    pgVolume: 46,

    scanPage,

    firstColumn,

    secondColumn:
      firstColumn + 1,
  };
}


export function mapPgScanPageToColumns(
  pgVolume: number,
  scanPage: number,
): PgColumnLocation {
  if (
    pgVolume === 46
  ) {
    return mapPg46ScanPageToColumns(
      scanPage,
    );
  }


  return {
    pgVolume,

    scanPage,

    firstColumn: null,

    secondColumn: null,
  };
}
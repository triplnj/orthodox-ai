export type ParsedPgReference = {
  volume: number;
  exactColumn: number | null;
  section: string | null;
  startColumn: number | null;
  endColumn: number | null;
};

export function parsePgReference(
  reference: string | null,
): ParsedPgReference | null {
  if (!reference) {
    return null;
  }

  const value = reference.trim();

  // Example:
  // PG 88:1013B
  const exact = value.match(
    /^PG\s*(\d+)\s*[:,]\s*(\d+)([A-D])?$/i,
  );

  if (exact) {
    return {
      volume: Number(exact[1]),
      exactColumn: Number(exact[2]),
      section: exact[3]?.toUpperCase() ?? null,
      startColumn: null,
      endColumn: null,
    };
  }

  // Example:
  // PG 88, c.631-1161
  const range = value.match(
    /^PG\s*(\d+)\s*,?\s*c\.?\s*(\d+)\s*[-–—]\s*(\d+)$/i,
  );

  if (range) {
    return {
      volume: Number(range[1]),
      exactColumn: null,
      section: null,
      startColumn: Number(range[2]),
      endColumn: Number(range[3]),
    };
  }

  // Example:
  // PG 88
  const volumeOnly = value.match(
    /^PG\s*(\d+)$/i,
  );

  if (volumeOnly) {
    return {
      volume: Number(volumeOnly[1]),
      exactColumn: null,
      section: null,
      startColumn: null,
      endColumn: null,
    };
  }

  return null;
}


export function pg88ColumnToWikisourcePage(
  column: number,
) {
  if (column < 1) {
    return null;
  }

  return Math.floor(
    (column + 10) / 2,
  );
}


export function buildPg88WikisourceUrl(
  page: number,
) {
  return (
    "https://el.wikisource.org/wiki/" +
    `Σελίδα:Patrologia_Graeca,_88_(1864).pdf/${page}`
  );
}


export function getPg88PagesForColumns(
  startColumn: number,
  endColumn: number,
) {
  const startPage =
    pg88ColumnToWikisourcePage(
      startColumn,
    );

  const endPage =
    pg88ColumnToWikisourcePage(
      endColumn,
    );

  if (
    startPage === null ||
    endPage === null
  ) {
    return [];
  }

  const pages: number[] = [];

  for (
    let page = startPage;
    page <= endPage;
    page++
  ) {
    pages.push(page);
  }

  return pages;
}
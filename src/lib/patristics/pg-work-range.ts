import * as cheerio from "cheerio";

export type PgWorkColumnRange = {
  firstColumn: number;
  lastColumn: number;
};

export type PgScanRange = {
  firstScanPage: number;
  lastScanPage: number;
};

function parseFirstInteger(
  value: string,
) {
  const match =
    value.match(
      /\d{1,4}/,
    );

  if (!match) {
    return null;
  }

  const parsed =
    Number(
      match[0],
    );

  return Number.isInteger(
    parsed,
  )
    ? parsed
    : null;
}

export function parsePgColumnRange(
  value:
    | string
    | undefined,
): PgWorkColumnRange | null {
  if (!value) {
    return null;
  }

  const numbers =
    value
      .match(
        /\d{1,4}/g,
      )
      ?.map(Number)
      .filter(
        (item) =>
          Number.isInteger(
            item,
          ),
      ) ??
    [];

  if (
    numbers.length === 0
  ) {
    return null;
  }

  const firstColumn =
    numbers[0];

  const lastColumn =
    numbers.length >= 2
      ? numbers[1]
      : numbers[0];

  if (
    firstColumn < 1 ||
    lastColumn <
      firstColumn
  ) {
    return null;
  }

  return {
    firstColumn,
    lastColumn,
  };
}

type ScandataEntry = {
  leafNum: number;
  printedNumber: number;
};

function parseScandata(
  xml: string,
) {
  const $ =
    cheerio.load(
      xml,
      {
        xmlMode: true,
      },
    );

  const entries:
    ScandataEntry[] =
      [];

  $("page").each(
    (_, page) => {
      const leafRaw =
        $(page).attr(
          "leafNum",
        ) ??
        $(page).attr(
          "leafnum",
        );

      const leafNum =
        leafRaw
          ? Number(
              leafRaw,
            )
          : NaN;

      const printedRaw =
        $(page)
          .find(
            "pageNumber",
          )
          .first()
          .text()
          .trim();

      const printedNumber =
        parseFirstInteger(
          printedRaw,
        );

      if (
        Number.isInteger(
          leafNum,
        ) &&
        leafNum >= 0 &&
        printedNumber !==
          null
      ) {
        entries.push({
          leafNum,
          printedNumber,
        });
      }
    },
  );

  return entries
    .sort(
      (a, b) =>
        a.leafNum -
        b.leafNum,
    );
}

function estimateSecondColumn(
  entries:
    ScandataEntry[],
  index: number,
) {
  const current =
    entries[index];

  const next =
    entries[index + 1];

  if (
    next &&
    next.printedNumber >
      current.printedNumber
  ) {
    const difference =
      next.printedNumber -
      current.printedNumber;

    if (
      difference >= 2 &&
      difference <= 4
    ) {
      return (
        current.printedNumber +
        difference -
        1
      );
    }
  }

  /*
   * Migne PG normally has two
   * numbered columns on each
   * scanned page.
   */
  return (
    current.printedNumber +
    1
  );
}

export async function mapPgColumnsToScanRange(
  scandataUrl:
    | string
    | null,
  columnRange:
    PgWorkColumnRange,
): Promise<
  PgScanRange | null
> {
  if (!scandataUrl) {
    return null;
  }

  let xml: string;

  try {
    const response =
      await fetch(
        scandataUrl,
        {
          headers: {
            "User-Agent":
              "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
          },

          next: {
            revalidate:
              60 *
              60 *
              24 *
              30,
          },
        },
      );

    if (!response.ok) {
      return null;
    }

    xml =
      await response.text();
  } catch {
    return null;
  }

  const entries =
    parseScandata(
      xml,
    );

  if (
    entries.length === 0
  ) {
    return null;
  }

  let firstScanPage:
    number | null = null;

  let lastScanPage:
    number | null = null;

  for (
    let index = 0;
    index <
    entries.length;
    index += 1
  ) {
    const entry =
      entries[index];

    const firstColumn =
      entry.printedNumber;

    const secondColumn =
      estimateSecondColumn(
        entries,
        index,
      );

    const overlaps =
      secondColumn >=
        columnRange.firstColumn &&
      firstColumn <=
        columnRange.lastColumn;

    if (!overlaps) {
      continue;
    }

    if (
      firstScanPage ===
      null
    ) {
      firstScanPage =
        entry.leafNum;
    }

    lastScanPage =
      entry.leafNum;
  }

  if (
    firstScanPage ===
      null ||
    lastScanPage ===
      null
  ) {
    return null;
  }

  return {
    firstScanPage,
    lastScanPage,
  };
}

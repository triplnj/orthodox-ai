import * as cheerio from "cheerio";

const PG_AUTHOR_INDEX_URL =
  "https://www.patrologiagraeca.org/patrologia/en/list-of-authors.html";

function normalize(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function expandRange(
  value: string,
) {
  const numbers =
    value
      .split("-")
      .map(
        (item) =>
          Number(
            item.trim(),
          ),
      )
      .filter(
        (item) =>
          Number.isInteger(
            item,
          ) &&
          item >= 1 &&
          item <= 161,
      );

  if (
    numbers.length === 0
  ) {
    return [];
  }

  if (
    numbers.length === 1
  ) {
    return [
      numbers[0],
    ];
  }

  const [first, last] =
    numbers;

  if (
    last < first ||
    last - first > 30
  ) {
    return [];
  }

  return Array.from(
    {
      length:
        last - first + 1,
    },
    (_, index) =>
      first + index,
  );
}

export async function resolvePgCatalogVolumes(
  names: string[],
): Promise<number[]> {
  const normalizedNames =
    [
      ...new Set(
        names
          .map(normalize)
          .filter(
            (name) =>
              name.length >= 4,
          ),
      ),
    ];

  if (
    normalizedNames.length === 0
  ) {
    return [];
  }

  let html: string;

  try {
    const response =
      await fetch(
        PG_AUTHOR_INDEX_URL,
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
      return [];
    }

    html =
      await response.text();
  } catch {
    return [];
  }

  const $ =
    cheerio.load(
      html,
    );

  const text =
    $("body")
      .text()
      .replace(
        /\s+/g,
        " ",
      );

  /*
   * The public PG index is organized as:
   * "PG 29-32: Basil the Great ..."
   *
   * Splitting on each PG heading gives us a small
   * deterministic catalogue segment for that volume
   * or range. We only accept a segment when the
   * resolved canonical author name occurs in it.
   */
  const parts =
    text.split(
      /PG\s+(\d+(?:\s*-\s*\d+)?)\s*:/gi,
    );

  const volumes:
    number[] = [];

  for (
    let index = 1;
    index + 1 <
    parts.length;
    index += 2
  ) {
    const range =
      parts[index];

    const segment =
      normalize(
        parts[index + 1]
          .slice(
            0,
            1200,
          ),
      );

    const matches =
      normalizedNames.some(
        (name) =>
          segment.includes(
            name,
          ),
      );

    if (!matches) {
      continue;
    }

    volumes.push(
      ...expandRange(
        range,
      ),
    );
  }

  return [
    ...new Set(
      volumes,
    ),
  ].sort(
    (a, b) =>
      a - b,
  );
}

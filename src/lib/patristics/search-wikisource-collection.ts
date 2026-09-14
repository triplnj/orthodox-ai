import * as cheerio from "cheerio";

import type {
  CuratedPatristicDocument,
} from "./curated-text-sources";

type MediaWikiSearchResponse = {
  query?: {
    search?: Array<{
      title: string;
    }>;
  };
};

function normalizeText(
  value: string,
) {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function unique<T>(
  values: T[],
) {
  return [
    ...new Set(values),
  ];
}

async function searchTitles(
  prefix: string,
  terms: string[],
) {
  const titles:
    string[] = [];

  /*
   * Search terms separately. A theological query
   * often contains synonyms that do not all occur
   * in the same homily.
   */
  for (
    const term of
    terms.slice(0, 6)
  ) {
    const params =
      new URLSearchParams({
        action: "query",
        list: "search",
        format: "json",
        utf8: "1",
        srlimit: "8",
        srnamespace: "0",
        srsearch:
          `intitle:"${prefix.replace(/\/$/, "")}" "${term}"`,
      });

    const response =
      await fetch(
        `https://en.wikisource.org/w/api.php?${params.toString()}`,
        {
          headers: {
            "User-Agent":
              "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
          },

          next: {
            revalidate:
              86400,
          },
        },
      );

    if (!response.ok) {
      continue;
    }

    const data =
      await response.json() as
        MediaWikiSearchResponse;

    for (
      const item of
      data.query?.search ?? []
    ) {
      if (
        item.title.startsWith(
          prefix,
        )
      ) {
        titles.push(
          item.title,
        );
      }
    }
  }

  return unique(
    titles,
  ).slice(0, 8);
}

async function fetchPageText(
  title: string,
) {
  const params =
    new URLSearchParams({
      action: "parse",
      page: title,
      prop: "text",
      format: "json",
      formatversion: "2",
    });

  const response =
    await fetch(
      `https://en.wikisource.org/w/api.php?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
        },

        next: {
          revalidate:
            86400,
        },
      },
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json() as {
      parse?: {
        text?: string;
      };
    };

  const html =
    data.parse?.text;

  if (!html) {
    return null;
  }

  const $ =
    cheerio.load(
      html,
    );

  $("script,style,nav,footer,header,sup").remove();

  const text =
    normalizeText(
      $.root().text(),
    );

  if (!text) {
    return null;
  }

  return {
    title,
    text,
    url:
      `https://en.wikisource.org/wiki/${encodeURIComponent(title).replace(/%2F/g, "/")}`,
  };
}

export async function searchWikisourceCollection(
  document:
    CuratedPatristicDocument,
  terms: string[],
) {
  const prefix =
    document.wikisourceTitlePrefix;

  if (
    !prefix ||
    terms.length === 0
  ) {
    return [];
  }

  const titles =
    await searchTitles(
      prefix,
      terms,
    );

  const pages =
    [];

  for (
    const title of titles
  ) {
    const page =
      await fetchPageText(
        title,
      );

    if (page) {
      pages.push(
        page,
      );
    }
  }

  return pages;
}

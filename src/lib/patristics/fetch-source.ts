import * as cheerio from "cheerio";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";


function normalizeExtractedText(
  value: string,
) {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}


function isPdfContentType(
  contentType: string | null,
) {
  return (
    contentType
      ?.toLowerCase()
      .includes("application/pdf") ??
    false
  );
}


function isPdfUrl(
  url: string,
) {
  return /\.pdf(?:$|\?)/i.test(
    url,
  );
}


function normalizeCharset(
  charset: string,
) {
  const value =
    charset
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();

  if (
    value === "windows-1252" ||
    value === "cp1252"
  ) {
    return "windows-1252";
  }

  if (
    value === "iso-8859-1" ||
    value === "latin1"
  ) {
    /*
     * Browsers interpret ISO-8859-1
     * HTML as Windows-1252.
     */
    return "windows-1252";
  }

  if (
    value === "utf8"
  ) {
    return "utf-8";
  }

  return value;
}


function detectCharsetFromContentType(
  contentType: string | null,
) {
  if (!contentType) {
    return null;
  }

  const match =
    contentType.match(
      /charset\s*=\s*["']?([^;"'\s]+)/i,
    );

  if (!match?.[1]) {
    return null;
  }

  return normalizeCharset(
    match[1],
  );
}


function detectCharsetFromHtml(
  bytes: Uint8Array,
) {
  /*
   * Charset declarations themselves use
   * ASCII-compatible characters, so Latin-1
   * is safe for inspecting the beginning
   * of the raw HTML.
   */
  const sample =
    new TextDecoder(
      "windows-1252",
    ).decode(
      bytes.slice(
        0,
        16384,
      ),
    );

  const directCharset =
    sample.match(
      /<meta[^>]+charset\s*=\s*["']?\s*([^"'\s/>;]+)/i,
    );

  if (
    directCharset?.[1]
  ) {
    return normalizeCharset(
      directCharset[1],
    );
  }


  const httpEquiv =
    sample.match(
      /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'\s;]+)[^"']*["']/i,
    );

  if (
    httpEquiv?.[1]
  ) {
    return normalizeCharset(
      httpEquiv[1],
    );
  }


  /*
   * Some older pages contain a charset
   * declaration in malformed or legacy
   * markup. This fallback deliberately
   * searches only the initial HTML block.
   */
  const generic =
    sample.match(
      /charset\s*=\s*["']?\s*([^"'\s;>]+)/i,
    );

  if (
    generic?.[1]
  ) {
    return normalizeCharset(
      generic[1],
    );
  }


  return null;
}


function decodeHtml(
  bytes: Uint8Array,
  contentType: string | null,
) {
  const charset =
    detectCharsetFromContentType(
      contentType,
    ) ??
    detectCharsetFromHtml(
      bytes,
    ) ??
    "utf-8";


  try {
    return new TextDecoder(
      charset,
    ).decode(
      bytes,
    );
  } catch {
    /*
     * Unknown or unsupported charset:
     * fall back conservatively to UTF-8.
     */
    return new TextDecoder(
      "utf-8",
    ).decode(
      bytes,
    );
  }
}


export async function fetchSourceText(
  url: string,
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",

          Accept:
            "text/html,application/xhtml+xml,application/pdf",
        },

        next: {
          revalidate:
            86400,
        },
      },
    );


  if (!response.ok) {
    throw new Error(
      `Could not fetch ${url}: ${response.status}`,
    );
  }


  const contentType =
    response.headers.get(
      "content-type",
    );


  const pdf =
    isPdfContentType(
      contentType,
    ) ||
    isPdfUrl(
      url,
    );


  if (pdf) {
    const arrayBuffer =
      await response.arrayBuffer();

   const parser =
  new PDFParse({
    data:
      new Uint8Array(
        arrayBuffer,
      ),
    CanvasFactory,
  });


    try {
      const result =
        await parser.getText();

      const text =
        normalizeExtractedText(
          result.text,
        );


      if (!text) {
        throw new Error(
          "PDF contains no extractable text.",
        );
      }


      return {
        url,
        title: "",
        html: "",
        text,
      };

    } finally {
      await parser.destroy();
    }
  }


  const arrayBuffer =
    await response.arrayBuffer();

  const bytes =
    new Uint8Array(
      arrayBuffer,
    );

  const html =
    decodeHtml(
      bytes,
      contentType,
    );


  const $ =
    cheerio.load(
      html,
    );


  $("script").remove();
  $("style").remove();
  $("nav").remove();
  $("footer").remove();
  $("header").remove();


  const title =
    $("title")
      .text()
      .trim();


  const text =
    normalizeExtractedText(
      $("body").text(),
    );


  return {
    url,
    title,
    html,
    text,
  };
}
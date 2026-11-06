/**
 * Manual, read-only acquisition and preview for the public-domain 1893
 * English translation of Gregory of Nyssa's On the Soul and Resurrection.
 * NO database access, NO embedding calls, NO production integration.
 * Source extraction is provisional until a human reviews coverage and
 * paragraph boundaries. Do not represent the preview as a complete work.
 *
 * Usage: node scripts/patristics/prepare-gregory-source.mjs
 */
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const SOURCE_URL = "https://www.newadvent.org/fathers/2915.htm";
const START = /Basil, great among the saints/i;
const END_START = /When such, then, have been purged from it/i;
const END_FINAL = /and in His Image, man as he was made\./i;

export function extractDocument(html) {
  if (typeof html !== "string" || html.length < 1000) {
    throw new Error("Source HTML is unexpectedly short");
  }
  const $ = load(html);
  $("script,style,nav,footer,header,aside,form,noscript").remove();
  // Prefer dedicated article containers; fallback to the page body if
  // publisher HTML changes. Start/end validations below fail closed.
  const candidates = ["#content", "main", "article", ".entry-content", "body"];
  let paragraphs = [];
  let selected = "";
  for (const selector of candidates) {
    const container = $(selector).first();
    if (!container.length) continue;
    const rows = container.find("p").toArray().map(el =>
      $(el).text().replace(/\s+/g, " ").trim()).filter(Boolean);
    if (rows.some(p => START.test(p))) {
      paragraphs = rows;
      selected = selector;
      break;
    }
  }
  if (!paragraphs.length) {
    throw new Error("Opening passage not found in HTML paragraphs; inspect site format");
  }
  let opening = paragraphs.findIndex(p => START.test(p));
  paragraphs = paragraphs.slice(opening);
  // Fail closed unless the verified final paragraph is present.
  // A site redesign must not silently import navigation or a truncated book.
  const end = paragraphs.findIndex(p => END_START.test(p) && END_FINAL.test(p));
  if (end < 0) throw new Error("Ending passage not found; source incomplete or changed");
  paragraphs = paragraphs.slice(0, end + 1);
  const final = paragraphs.at(-1);
  const endMatch = final.match(END_FINAL);
  if (!endMatch || final.slice(endMatch.index + endMatch[0].length).trim()) {
    throw new Error("Book ending mixed with website material; manual review required");
  }
  if (paragraphs.some(p => /About this page|Contact information|ADVERTISE WITH NEW ADVENT|Copyright ©/.test(p))) {
    throw new Error("Non-book website material detected inside extracted text");
  }
  const words = paragraphs.join(" ").split(/\s+/).length;
  if (paragraphs.length < 20 || words < 5000) {
    throw new Error("Source too short for a reliable long-form preview");
  }
  const allText = paragraphs.join("\n\n");
  const sha256 = createHash("sha256").update(allText).digest("hex");
  const metadata = {
    sourceUrl: SOURCE_URL,
    work: "On the Soul and the Resurrection",
    author: "St. Gregory of Nyssa",
    edition: "Nicene and Post-Nicene Fathers, Second Series, Vol. 5 (1893)",
    language: "English",
    extraction: { selectedContainer: selected, paragraphCount: paragraphs.length,
      wordCount: words, sha256, coverage: "UNVERIFIED_PREVIEW",
      warning: "Automatically extracted paragraphs have provisional locators. Verify the start, end, completeness, and editorial text before importing." },
    first: paragraphs.slice(0,2),
    last: paragraphs.slice(-2),
  };
  return {metadata,paragraphs};
}

export function extractPreview(html) {
  return extractDocument(html).metadata;
}

export async function fetchSourceDocument(fetcher = fetch) {
  const response = await fetcher(SOURCE_URL, {
    headers: { "User-Agent": "OrthodoxAI-PatristicSourcePreview/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Source returned HTTP " + response.status);
  const type = response.headers?.get?.("content-type") ?? "";
  if (type && !type.includes("html")) {
    throw new Error("Expected HTML, received: " + type);
  }
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("Source HTML exceeds 5MB safety limit");
  return extractDocument(html);
}

export async function prepareSource(fetcher = fetch) {
  return (await fetchSourceDocument(fetcher)).metadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareSource()
    .then(result => process.stdout.write(JSON.stringify(result, null, 2) + "\n"))
    .catch(error => { process.stderr.write("SOURCE_PREVIEW_FAILED: " + error.message + "\n"); process.exitCode = 1; });
}

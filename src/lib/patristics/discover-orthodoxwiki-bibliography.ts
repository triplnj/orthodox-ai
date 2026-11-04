import * as cheerio from "cheerio";
import { safeSourceFetch } from "@/lib/security/source-transport";
import { fetchSourceText } from "./fetch-source";
import type { CuratedTextEvidence } from "./search-curated-texts";

// OrthodoxWiki is a community-maintained bibliographic reference, not a
// primary witness for exact theological quotations.
const BIOGRAPHICAL_REQUEST = /(?:saint|st\.?|sveti|svetog|свети|светог|светиња|who was|who is|ко је|који је|works|writings|books|bibliograph|дела|делима|спис[аи]|књиг[ае]|биограф|живот|писао|писањ)/iu;
const HEADING = /^(?:selected bibliography|selected works|written works|works|writings|publications|књиге|дела)$/iu;

function latin(value: string) {
  const chars: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",ђ:"dj",е:"e",ж:"z",з:"z",и:"i",ј:"j",
    к:"k",л:"l",љ:"lj",м:"m",н:"n",њ:"nj",о:"o",п:"p",р:"r",с:"s",
    т:"t",ћ:"c",у:"u",ф:"f",х:"h",ц:"c",ч:"c",џ:"dz",ш:"s",
  };
  return value.toLowerCase().split("").map(c => chars[c] ?? c).join("")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"dj").replace(/ł/g,"l");
}
function words(value: string) {
  return latin(value).replace(/[^a-z\s-]/g, " ").split(/[\s-]+/)
    .filter(t => t.length >= 4 && !["saint","sveti","svetog","who","what","works","writings","books","justinov","popovica","celijski","celijskog","orthodox","church","svetog","свети"].includes(t));
}
function subject(query: string): string | null {
  if (!BIOGRAPHICAL_REQUEST.test(query)) return null;
  // Parenthetical surname variant: Saint Justin Ćelijski (Popović).
  const match = query.match(/(?:saint|st\.?|sveti|svetog|свети|светог|св\.?)\s+([\p{L}][\p{L}.'’-]*(?:\s+[\p{L}][\p{L}.'’-]*){0,3})(?:\s*\(([\p{L}.'’-]+)\))?/iu);
  if (!match) return null;
  const name = match[1].split(/\s+(?:was|is|who|који|која|је|и|and|чији|чија|чије|чијих|које|којих)(?=\s|$)/iu)[0].trim();
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length < 2) return null;
  const surname = match[2] || parts[parts.length - 1];
  return `${parts[0]} ${surname}`;
}
export function orthodoxWikiSearchTerms(name: string): string[] {
  const tokens = words(name);
  if (tokens.length < 2) return [];
  // Serbian genitive endings (Јустина Поповића) are not the article's
  // English nominative (Justin Popovich). Search predictable variants.
  const stems = tokens.map(token => token.endsWith("a") && token.length > 5 ? token.slice(0, -1) : token);
  const variants = [
    stems.join(" "),
    stems.map(t => t.endsWith("c") ? t.slice(0,-1)+"ch" : t).join(" "),
    tokens.join(" "),
  ];
  return [...new Set(variants.filter(Boolean))];
}
export function samePerson(title: string, name: string) {
  const a = words(name), b = words(title);
  return a.length >= 2 && a.every(token => b.some(candidate =>
    candidate === token || (token.length >= 5 && candidate.length >= 5 &&
      candidate.slice(0, 5) === token.slice(0, 5))));
}
export function bibliography(html: string) {
  const $ = cheerio.load(html);
  const entries: string[] = [];
  $("h2, h3, h4").each((_i, el) => {
    const heading = $(el).text().replace(/\[edit\]/gi, "").trim();
    if (!HEADING.test(heading)) return;
    let node = $(el).next();
    // MediaWiki wraps heading text in a nested element but retains <h2>.
    for (let i = 0; i < 25 && node.length && !/^h[1-4]$/i.test(node.get(0)?.tagName || ""); i++, node = node.next()) {
      node.find("li").addBack("li").each((_j, li) => {
        const title = $(li).text().replace(/\[[0-9]+\]/g, "").replace(/\s+/g," ").trim();
        if (title.length >= 7 && title.length <= 300 && entries.length < 35) entries.push(title);
      });
    }
  });
  return [...new Set(entries)];
}
export async function discoverOrthodoxWikiBibliography(query: string): Promise<CuratedTextEvidence[]> {
  const name = subject(query);
  if (!name) return [];
  try {
    const terms = orthodoxWikiSearchTerms(name);
    const candidates: string[] = [];
    // Direct article requests are an independent fallback when MediaWiki's
    // search endpoint is rate-limited, blocked, or returns no matching title.
    for (const term of terms) {
      candidates.push(term.split(" ").map(token => token[0]?.toUpperCase() + token.slice(1)).join("_"));
    }
    for (const searchTerm of terms) {
      try {
        const endpoint = new URL("https://orthodoxwiki.org/api.php");
        endpoint.searchParams.set("action", "query");
        endpoint.searchParams.set("list", "search");
        endpoint.searchParams.set("srsearch", searchTerm);
        endpoint.searchParams.set("srlimit", "12");
        endpoint.searchParams.set("format", "json");
        const response = await safeSourceFetch(endpoint.toString(), { headers: { Accept: "application/json" } });
        if (!response.ok) continue;
        const data = await response.json() as { query?: { search?: Array<{ title?: string }> } };
        for (const result of data.query?.search ?? []) {
          if (result.title && samePerson(result.title, name)) candidates.unshift(result.title.replace(/ /g, "_"));
        }
        if (data.query?.search?.some(result => result.title && samePerson(result.title, name))) break;
      } catch {
        // The direct article candidates remain available independently.
      }
    }
    let page: Awaited<ReturnType<typeof fetchSourceText>> | null = null;
    let pageUrl = "";
    let resolvedTitle = "";
    for (const title of [...new Set(candidates)].slice(0, 12)) {
      try {
        const url = `https://orthodoxwiki.org/${encodeURIComponent(title)}`;
        const fetched = await fetchSourceText(url);
        // Reject search pages, missing articles and mistaken identity.
        if (!samePerson(fetched.title.replace(/\\s*[-–|].*$/, ""), name)) continue;
        if (!/\\b(?:orthodoxwiki|justin|saint|st\\.)\\b/i.test(fetched.title) && fetched.text.length < 200) continue;
        page = fetched;
        pageUrl = url;
        resolvedTitle = fetched.title;
        break;
      } catch {
        continue;
      }
    }
    if (!page) return [];
    const works = bibliography(page.html);
    // Do not report a generic article as bibliographic proof when no work list was extracted.
    if (!works.length) return [];
    const excerpt = [
      `OrthodoxWiki entry: ${resolvedTitle}`,
      "This is a community-edited secondary reference, suitable for attributed biographical and bibliographic summaries, NOT a primary text.",
      "WORKS LISTED IN THIS PAGE (preserve titles exactly; do not invent additional titles):",
      ...works.map(title => `- ${title}`),
      "BIOGRAPHICAL TEXT:",
      page.text.slice(0, 3500),
    ].join("\n");
    return [{
      authorName: resolvedTitle,
      workTitle: works.length ? "OrthodoxWiki — selected bibliography" : "OrthodoxWiki — biographical entry",
      originalLanguage: "English",
      sourceUrl: pageUrl,
      sourceName: "OrthodoxWiki",
      documentType: "BIBLIOGRAPHIC",
      verificationStatus: "COMMUNITY_EDITED_BIBLIOGRAPHIC_SOURCE",
      excerpt: excerpt.slice(0, 9000),
      matchedTerms: [name],
    }];
  } catch {
    // A search failure is not evidence that the named person has no works.
    return [];
  }
}

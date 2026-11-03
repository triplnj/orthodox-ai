import * as cheerio from "cheerio";
import { fetchSourceText } from "./fetch-source";
import type { CuratedTextEvidence } from "./search-curated-texts";

/*
 * Discover official Orthodox hagiographies without hardcoding each saint.
 * Search results are just candidate links. We fetch and inspect the actual
 * saint's page and require two identifying name tokens before attribution.
 */
function latin(value: string) {
  const letters: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",ђ:"dj",е:"e",ж:"z",з:"z",и:"i",ј:"j",
    к:"k",л:"l",љ:"lj",м:"m",н:"n",њ:"nj",о:"o",п:"p",р:"r",с:"s",
    т:"t",ћ:"c",у:"u",ф:"f",х:"h",ц:"c",ч:"c",џ:"dz",ш:"s"
  };
  return value.toLowerCase().split("").map(c => letters[c] ?? c).join("")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function nameTokens(value: string) {
  return latin(value).replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).map(x => ({
    jovan:"john", ioann:"john", iovan:"john", johann:"john", johannes:"john",
    nikolaj:"nicholas", nikola:"nicholas", grigorije:"gregory", serafim:"seraphim",
  }[x] ?? x)).filter(x => x.length >= 3 && !["saint","sveti","svetog","sv","the","of","holy","who","is","what","ko","je","su","and"].includes(x));
}
export function saintSubject(query: string): string[] {
  const match = query.match(/(?:\b(?:st\.?|saint|sveti|svetog|sv\.)\s+|(?:свети|светог|св\.)\s+)([\p{L}][\p{L}\s.'-]{2,70})/iu);
  if (!match) return [];
  const name = match[1].split(/(?:\s+(?:и|који|која|what|who|whose|and|is|are|је|су|шта)(?=\s|$)|[?!,])/iu)[0];
  const tokens = nameTokens(name);
  return tokens.length >= 2 ? tokens.slice(0, 5) : [];
}
function matched(candidate: string, tokens: string[]) {
  const haystack = nameTokens(candidate);
  return tokens.every(token =>
    haystack.some(part => part === token ||
      (Math.min(part.length,token.length) >= 5 && part.slice(0,5) === token.slice(0,5))));
}
export async function discoverOfficialSaintLife(query: string): Promise<CuratedTextEvidence[]> {
  const tokens = saintSubject(query);
  if (tokens.length < 2) return [];
  // A given name is broadly indexed; avoid non-matching historical people.
  const search = new URL("https://www.oca.org/saints/lives");
  search.searchParams.set("q", tokens[0]);
  try {
    const page = await fetchSourceText(search.toString());
    const $ = cheerio.load(page.html);
    const candidates: string[] = [];
    $("a[href]").each((_index, anchor) => {
      const raw = $(anchor).attr("href");
      if (!raw || !/\/saints\/lives\/\d+\/\d+\/\d+\/[^/?#]+/.test(raw)) return;
      const url = new URL(raw, "https://www.oca.org");
      if (url.hostname !== "www.oca.org" || !matched(url.pathname.split("/").pop() ?? "", tokens)) return;
      if (!candidates.includes(url.toString())) candidates.push(url.toString());
    });
    for (const url of candidates.slice(0, 3)) {
      try {
        const entry = await fetchSourceText(url);
        const title = entry.title || "";
        const startText = entry.text.slice(0, 14000);
        if (!matched(title+" "+url.split("/").pop(), tokens) || startText.length < 250) continue;
        const excerpt = startText.slice(0, 8500);
        return [{
          authorName: "Orthodox Church in America",
          workTitle: title || "Life of a Saint",
          originalLanguage: "English",
          sourceUrl: url,
          sourceName: "Orthodox Church in America — Lives of the Saints",
          documentType: "BIBLIOGRAPHIC",
          verificationStatus: "OFFICIAL_ORTHODOX_HAGIOGRAPHY",
          excerpt,
          matchedTerms: tokens,
        }];
      } catch { /* Try next matching life; do not fabricate a result. */ }
    }
  } catch { /* A failed official source is not evidence. */ }
  return [];
}

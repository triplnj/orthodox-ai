import type { PatristicResearchContext } from "./build-patristic-research-context";

/** Use an attributed, fetched bibliography rather than asking a language model
 * to invent a plausible list. This covers requested lists, not doctrinal queries. */
export function isBibliographyListingQuestion(message: string): boolean {
  const listing = /(?:наведи|наброј|поброј|списак|која су|које су|list|enumerate|bibliograph|дела|књиге|works|books|writings)/iu.test(message);
  const subject = /(?:свет[ио]|svet[io]|saint|st\.|от[ао]ц|father|ав[ае]|ava|преподобн)/iu.test(message);
  return listing && subject;
}

export function verifiedBibliographyAnswer(
  message: string,
  research: PatristicResearchContext | null,
): string | null {
  if (!isBibliographyListingQuestion(message)) return null;
  const source = research?.sources.find(item =>
    item.verificationStatus === "COMMUNITY_EDITED_BIBLIOGRAPHIC_SOURCE" &&
    typeof item.metadata?.excerpt === "string" &&
    item.metadata.excerpt.includes("WORKS LISTED IN THIS PAGE"));
  if (!source) return null;
  const excerpt = String(source.metadata?.excerpt);
  const match = excerpt.match(/WORKS LISTED IN THIS PAGE[^\n]*\n([\s\S]*?)(?:\nBIOGRAPHICAL TEXT:|$)/);
  if (!match) return null;
  const titles = match[1].split("\n").filter(x => x.startsWith("- "))
    .map(x => x.slice(2).trim()).filter(Boolean);
  if (!titles.length) return null;
  const name = source.authorName || "the author";
  const cyrillic = /\p{Script=Cyrillic}/u.test(message);
  if (cyrillic) return [
    `Према библиографском списку на OrthodoxWiki за аутора ${name}, наведена су следећа дела:`,
    "",
    ...titles.map((title, i) => `${i + 1}. ${title}`),
    "",
    "Ово је списак преузет из наведеног извора, не потпуна библиографија свих издања, превода и краћих радова. Називе сам задржао у облику у којем су наведени у извору.",
  ].join("\n");
  return [
    `The following works are listed in the OrthodoxWiki bibliography for ${name}:`,
    "",
    ...titles.map((title, i) => `${i + 1}. ${title}`),
    "",
    "This reproduces the source's selected bibliography, not a complete catalog of every edition, translation, or shorter work.",
  ].join("\n");
}

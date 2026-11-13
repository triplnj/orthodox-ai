import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";

/**
 * General-purpose, deterministic post-generation guard for attributed direct
 * quotations. An answer model saying "source verified" is never evidence.
 * We accept an exact match only against a retriever-supplied PRIMARY PASSAGE,
 * not against bibliographic notes, descriptions, discovery snippets or URLs.
 *
 * A translated/paraphrased sentence is NOT the identical wording of a published
 * translation. Unless a matching passage in that language is actually supplied,
 * remove the unsupported quote-bearing line instead of laundering quotation
 * marks into an apparently sourced paraphrase.
 */
export type QuoteGuardResult = {
  answer: string;
  removed: number;
  retained: number;
};

const quotePattern = /„([^„“\n]{1,450})“|“([^“”\n]{1,450})”|«([^«»\n]{1,450})»|(?<!\w)"([^"\n]{1,450})"(?!\w)/gu;
const norm = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const words = (value: string) => value.match(/[\p{L}\p{N}]+/gu) ?? [];

/** Only source-excerpt / verbatim extracted text, NEVER metadata note/quote by model. */
function sourcedPassages(sources: PatristicResearchSource[]): string[] {
  const passages: string[] = [];
  for (const source of sources) {
    // Editorial bibliography records have a different evidentiary contract:
    // their descriptive supportingStatement is NOT the Father's direct wording.
    if (source.metadata?.bibliographyCatalog === true || source.metadata?.graphRecord === true) continue;
    if (typeof source.metadata?.excerpt === "string" && source.metadata.excerpt.trim()) {
      passages.push(norm(source.metadata.excerpt));
    }
    if (source.verificationStatus === "LIVE_BIBLIOGRAPHY_EXCERPT_MATCH") continue;
    // A genuinely fetched excerpt may be available in the metadata, but do
    // not accept an AI-authored supportingStatement or an unvalidated URL.
    if (source.metadata?.sourceKind === "PRIMARY_PASSAGE" &&
        typeof source.metadata?.evidenceQuote === "string") {
      passages.push(norm(source.metadata.evidenceQuote));
    }
  }
  return passages;
}

export function enforceVerbatimPatristicQuotes(answer: string, sources: PatristicResearchSource[]): QuoteGuardResult {
  const passages = sourcedPassages(sources);
  let removed = 0;
  let retained = 0;
  const lines = answer.split("\n");
  const cleaned = lines.filter(line => {
    const quotes = [...line.matchAll(quotePattern)]
      .map(match => ({
        value: match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
        before: line.slice(Math.max(0, match.index - 65), match.index),
      }))
      // A quoted title after an explicit bibliographic cue is not presented
      // as a verbatim patristic sentence. Short technical terms are also safe.
      .filter(({ value, before }) => words(value).length >= 4 &&
        !/(?:написао је|написала је|(?:дело|спис|књига|наслов)\s*[:—-]?\s*$|(?:titled|title|work|book)\s*[:—-]?\s*$)/iu.test(before))
      .map(item => item.value);
    if (!quotes.length) return true;
    const supported = quotes.every(quote => passages.some(passage => passage.includes(norm(quote))));
    if (supported) { retained += quotes.length; return true; }
    removed += quotes.filter(quote => !passages.some(passage => passage.includes(norm(quote)))).length;
    return false;
  });
  if (!removed) return { answer, removed, retained };
  const body = cleaned.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  const disclaimer = /[\p{Script=Cyrillic}]/u.test(answer)
    ? "Дословни наводи за које није пронађен потврђен одломак из извора изостављени су."
    : "Unverified verbatim quotations were omitted because no matching source passage was supplied.";
  return { answer: body ? body + "\n\n" + disclaimer : disclaimer, removed, retained };
}

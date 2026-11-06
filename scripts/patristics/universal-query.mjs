/**
 * General-purpose, author-agnostic Orthodox source query planning.
 * These labels ROUTE retrieval; they are not theological judgements.
 * This module has no network, database or live-chat dependencies.
 */
export const QUERY_INTENTS = Object.freeze([
  "BIBLIOGRAPHY", "BIOGRAPHY", "SCRIPTURE_COMMENTARY",
  "SOURCE_LOCATION", "COMPARATIVE_TEACHING", "DOCTRINAL_EXPLANATION",
  "ORTHODOX_TRADITION", "GENERAL_SOURCE_RESEARCH"
]);

const patterns = [
  ["BIBLIOGRAPHY", /(?:works|writings|books|bibliography|wrote|authored|spisi|dela|knjige|napisao|написао|дела|списи|књиге|делима)/iu],
  ["BIOGRAPHY", /(?:who was|who is|life of|biography|born|died|ko je|ko bio|život|biografija|ко је|живот|биографија|рођен)/iu],
  ["SCRIPTURE_COMMENTARY", /(?:interpret|commentary|explain (?:john|matthew|romans|psalm|corinthians)|tumač|tumačenje|тумач|тумачење|стих|verse|scripture|свето писмо)/iu],
  ["SOURCE_LOCATION", /(?:find|locate|source|citation|quote|where does|pronađi|izvor|citat|gde piše|пронађи|извор|цитат|где пише|одломак|passage)/iu],
  ["COMPARATIVE_TEACHING", /(?:compare|difference between|vs\.?|contrast|uporedi|razlika|упореди|разлика|поређење)/iu],
  ["DOCTRINAL_EXPLANATION", /(?:teach|teaches|teaching|doctrine|understand|uči|učenje|учење|учи|шта каже|what does)/iu],
  ["ORTHODOX_TRADITION", /(?:tradition|liturgy|fasting|prayer|icon|sacrament|orthodox|предање|литургија|пост|молитва|икона|тајна|православ)/iu],
];

export function planUniversalQuery(question, options = {}) {
  if(typeof question !== "string" || !question.trim() || question.length > 2000){
    throw new Error("Question must be nonempty and at most 2000 characters");
  }
  const normalized = question.trim().normalize("NFC");
  const intent = patterns.find(([,re])=>re.test(normalized))?.[0] ?? "GENERAL_SOURCE_RESEARCH";
  const sourceKinds = intent === "BIOGRAPHY" || intent === "BIBLIOGRAPHY"
    ? ["CATALOG_METADATA", "REFERENCE_SOURCE", "PRIMARY_TEXT"]
    : intent === "SCRIPTURE_COMMENTARY"
      ? ["SCRIPTURE_REFERENCE", "PRIMARY_TEXT", "REFERENCE_SOURCE"]
      : ["PRIMARY_TEXT", "REFERENCE_SOURCE", "CATALOG_METADATA"];
  const scope = options.scope ?? "ALL_STAGED";
  if(scope !== "ALL_STAGED") throw new Error("Only explicitly isolated staging searches are permitted");
  return {
    question:normalized,
    intent,
    scope,
    sourceKinds,
    requiresProvenance:true,
    allowUnverifiedDirectQuotes:false,
    allowUnsupportedAnswer:false,
    requiresCrossSourceReview:intent==="COMPARATIVE_TEACHING"
  };
}

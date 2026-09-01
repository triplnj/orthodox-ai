type HybridQuote = {
  translationEn: string | null;
  translationSr: string | null;
  originalText: string;
  topics: string[];
  similarity: number;
};

const STOPWORDS = new Set([
  "what",
  "does",
  "say",
  "says",
  "about",
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "into",
  "fathers",
  "father",
  "saint",
]);

function normalize(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(query: string) {
  return normalize(query)
    .split(" ")
    .filter((term) => term.length >= 4 && !STOPWORDS.has(term));
}

export function calculateHybridScore(
  query: string,
  quote: HybridQuote,
) {
  const terms = queryTerms(query);

 const searchableText = normalize(
  [
    quote.translationEn ?? "",
    quote.translationSr ?? "",
    quote.originalText,
  ].join(" "),
);

  let matchedTerms = 0;

  for (const term of terms) {
    if (searchableText.includes(term)) {
      matchedTerms += 1;
    }
  }

  const keywordScore =
    terms.length > 0 ? matchedTerms / terms.length : 0;

  const hybridScore =
    quote.similarity * 0.7 +
    keywordScore * 0.3;

  return {
    semanticScore: quote.similarity,
    keywordScore,
    hybridScore,
    matchedTerms,
    totalTerms: terms.length,
  };
}
function normalizeUnicode(value: string) {
  return value.normalize("NFC");
}

function normalizeWhitespace(value: string) {
  return normalizeUnicode(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function exactQuoteExists(
  quote: string,
  sourceText: string,
) {
  const normalizedQuote =
    normalizeWhitespace(quote);

  const normalizedSource =
    normalizeWhitespace(sourceText);

  if (normalizedQuote.length < 20) {
    return false;
  }

  return normalizedSource.includes(
    normalizedQuote,
  );
}
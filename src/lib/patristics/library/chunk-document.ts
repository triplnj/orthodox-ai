/**
 * Additive, offline document segmentation for the prospective patristic library.
 * Does not touch Prisma, the chat route, or the existing quotation index.
 */
export type LibraryDocument = {
  corpus: string;
  authorKey: string;
  authorName: string;
  workKey: string;
  workTitle: string;
  editionKey: string;
  originalLanguage: string;
  sourceUrl: string;
  licenseNote: string;
  passageLocator: string;
  text: string;
};

export type LibraryPassage = {
  ordinal: number;
  locator: string;
  content: string;
  previousOrdinal: number | null;
  nextOrdinal: number | null;
};

function paragraphsOf(text: string): string[] {
  return text.replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/g)
    .map(part => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitLongParagraph(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) { parts.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxChars) {
        parts.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    if (current && current.length + 1 + word.length > maxChars) {
      parts.push(current);
      current = "";
    }
    current = current ? current + " " + word : word;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Keep paragraphs intact when possible. Adjacent passage pointers permit
 * retrieving wider argument context at answer time; no invented locators.
 */
export function chunkLibraryDocument(
  document: LibraryDocument,
  maxChars = 1800,
): LibraryPassage[] {
  if (!Number.isInteger(maxChars) || maxChars < 200 || maxChars > 12000) {
    throw new RangeError("maxChars must be an integer from 200 to 12000");
  }
  if (!document.editionKey || !document.workKey ||
      !document.passageLocator || !document.sourceUrl ||
      !/^https:\/\//.test(document.sourceUrl)) {
    throw new Error("Work, edition, explicit locator and HTTPS provenance are required");
  }
  const segments = paragraphsOf(document.text)
    .flatMap(part => part.length <= maxChars ? [part] : splitLongParagraph(part, maxChars));
  const chunks: string[] = [];
  let buffer = "";
  for (const part of segments) {
    if (buffer && buffer.length + 2 + part.length > maxChars) {
      chunks.push(buffer);
      buffer = "";
    }
    buffer = buffer ? buffer + "\n\n" + part : part;
  }
  if (buffer) chunks.push(buffer);
  return chunks.map((content, ordinal) => ({
    ordinal,
    locator: document.passageLocator,
    content,
    previousOrdinal: ordinal > 0 ? ordinal - 1 : null,
    nextOrdinal: ordinal + 1 < chunks.length ? ordinal + 1 : null,
  }));
}

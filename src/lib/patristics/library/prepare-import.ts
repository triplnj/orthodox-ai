/**
 * Offline library import planner. No database or network access.
 * Output may only be written to a staging branch after human provenance review.
 */
import { createHash } from "node:crypto";
import { chunkLibraryDocument, type LibraryDocument } from "./chunk-document";

export type LibraryImportPlan = {
  author: { id: string; canonicalName: string };
  work: { id: string; authorId: string; title: string };
  edition: {
    id: string; workId: string; corpus: LibraryCorpus;
    editionTitle: string; originalLanguage: string;
    sourceUrl: string; licenseNote: string;
    importStatus: "STAGED";
  };
  passages: Array<{
    id: string; editionId: string; locator: string;
    ordinal: number; content: string; contentSha256: string;
    language: string; ocrQuality: "UNREVIEWED";
  }>;
};

export type LibraryCorpus =
  "PG" | "PL" | "PHILOKALIA" | "MODERN_ORTHODOX" | "CURATED_OTHER";

export type ImportDocument = LibraryDocument & {
  editionTitle: string;
  licenseReviewed: boolean;
  attributionReviewed: boolean;
};

const corpora = new Set<LibraryCorpus>([
  "PG", "PL", "PHILOKALIA", "MODERN_ORTHODOX", "CURATED_OTHER",
]);

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableId(kind: string, ...parts: string[]): string {
  // The tuple must be encoded without ambiguous separators.
  return kind + "_" + digest(JSON.stringify(parts)).slice(0, 32);
}

export function planLibraryImport(input: ImportDocument, maxChars = 1800): LibraryImportPlan {
  if (!corpora.has(input.corpus as LibraryCorpus)) {
    throw new Error("Unsupported library corpus");
  }
  if (!input.licenseReviewed || !input.attributionReviewed) {
    throw new Error("Edition license and work attribution must be reviewed before import");
  }
  for (const key of ["authorKey", "authorName", "workKey", "workTitle",
      "editionKey", "editionTitle", "originalLanguage", "sourceUrl",
      "licenseNote", "passageLocator", "text"] as const) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      throw new Error("Missing required import field: " + key);
    }
  }
  const url = new URL(input.sourceUrl);
  if (url.protocol !== "https:" || !url.hostname ||
      url.username || url.password || !input.sourceUrl.startsWith("https://")) {
    throw new Error("Source provenance must be a credential-free HTTPS URL");
  }
  if (input.text.length > 2_000_000) {
    throw new Error("Split very large texts into chapters before importing");
  }
  const authorId = stableId("author", input.authorKey.trim().toLowerCase());
  const workId = stableId("work", authorId, input.workKey.trim().toLowerCase());
  const editionId = stableId("edition", workId, input.editionKey.trim().toLowerCase());
  const paragraphs = chunkLibraryDocument(input, maxChars);
  if (!paragraphs.length) throw new Error("No usable passages found");
  return {
    author: { id: authorId, canonicalName: input.authorName.trim() },
    work: { id: workId, authorId, title: input.workTitle.trim() },
    edition: {
      id: editionId, workId, corpus: input.corpus as LibraryCorpus,
      editionTitle: input.editionTitle.trim(), originalLanguage: input.originalLanguage.trim(),
      sourceUrl: input.sourceUrl, licenseNote: input.licenseNote.trim(),
      importStatus: "STAGED",
    },
    passages: paragraphs.map(part => ({
      id: stableId("passage", editionId, input.passageLocator, String(part.ordinal)),
      editionId, locator: input.passageLocator, ordinal: part.ordinal,
      content: part.content, contentSha256: digest(part.content),
      language: input.originalLanguage, ocrQuality: "UNREVIEWED" as const,
    })),
  };
}

import {
  buildVerifiedPatristicContext,
  type PatristicLanguage,
} from "./build-chat-context";

import {
  buildLivePgChatContext,
  type LivePgSource,
} from "./build-live-pg-chat-context";

import {
  searchCuratedPatristicTexts,
  type CuratedTextEvidence,
} from "./search-curated-texts";

import {
  findCuratedPatristicDocuments,
} from "./curated-text-sources";

import {
  detectPatristicAuthor,
} from "./detect-author";

import {
  isGenericPatristicResearchQuery,
  shouldRunPatristicResearch,
} from "./should-run-patristic-research";

import {
  researchPatristicQuestionOnWeb,
} from "./web-patristic-research";

export type PatristicResearchSource = {
  provider:
    | "VERIFIED_DB"
    | "CURATED_TEXT"
    | "PATROLOGIA_GRAECA"
    | "WEB_RESEARCH";

  authorName: string | null;
  workTitle: string | null;
  reference: string | null;
  originalLanguage: string | null;
  sourceUrl: string;
  scanUrl: string | null;
  verificationStatus: string;
};

export type PatristicResearchContext = {
  context: string;
  sources: PatristicResearchSource[];
  providersAttempted: string[];
  providersSucceeded: string[];
};

function detectRetrievalLanguage(query: string): PatristicLanguage {
  if (/\p{Script=Cyrillic}/u.test(query)) return "sr";

  const normalized = query.toLowerCase();
  if (/\b(sveti|svetog|svetom|duša|dusa|ikona|spasenje|vaskrsenje|molitva|post|greh|grijeh|greha|grehova)\b/.test(normalized)) {
    return "sr";
  }

  return "en";
}

function mapPgSources(sources: LivePgSource[]): PatristicResearchSource[] {
  return sources.map((source) => ({
    provider: "PATROLOGIA_GRAECA",
    authorName: source.authorName,
    workTitle: source.workTitle,
    reference:
      source.pgReference ??
      `PG ${source.pgVolume}, digital scan page ${source.scanPage}`,
    originalLanguage: "Greek",
    sourceUrl: source.sourceUrl,
    scanUrl: source.pageImageUrl,
    verificationStatus: "PRIMARY_SOURCE_OCR",
  }));
}

function mapCuratedSources(evidence: CuratedTextEvidence[]): PatristicResearchSource[] {
  return evidence.map((item) => ({
    provider: "CURATED_TEXT",
    authorName: item.authorName,
    workTitle: item.workTitle,
    reference: null,
    originalLanguage: item.originalLanguage,
    sourceUrl: item.sourceUrl,
    scanUrl: null,
    verificationStatus: item.verificationStatus,
  }));
}

function formatCuratedContext(evidence: CuratedTextEvidence[]) {
  const blocks = evidence.map((item, index) => [
    `[CURATED_SOURCE_${index + 1}]`,
    `AUTHOR: ${item.authorName}`,
    `WORK: ${item.workTitle}`,
    `DOCUMENT_TYPE: ${item.documentType}`,
    `SOURCE_LANGUAGE: ${item.originalLanguage}`,
    `SOURCE_NAME: ${item.sourceName}`,
    `SOURCE_URL: ${item.sourceUrl}`,
    `VERIFICATION: ${item.verificationStatus}`,
    `MATCHED_TERMS: ${item.matchedTerms.join(", ") || "None"}`,
    "SOURCE_EXCERPT:",
    item.excerpt,
    `[/CURATED_SOURCE_${index + 1}]`,
  ].join("\n"));

  return [
    "CURATED PATRISTIC SOURCE CONTEXT:",
    "",
    "The following excerpts come from deterministic, pre-approved source URLs.",
    "Do not claim that a translation is the original-language text unless SOURCE_LANGUAGE says so.",
    "For BIBLIOGRAPHIC documents, use the excerpt only for historical/bibliographic claims.",
    "",
    ...blocks,
  ].join("\n\n");
}

function deduplicateSources(sources: PatristicResearchSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    const key = [
      source.provider,
      source.sourceUrl,
      source.scanUrl ?? "",
      source.reference ?? "",
    ].join(":");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFinalContext(contextParts: string[]) {
  return [
    "PATRISTIC RESEARCH CONTEXT",
    "",
    "Rules:",
    "- Attribute a specific teaching to a Church Father only when supported by the evidence below.",
    "- Do not replace missing evidence with generic Orthodox teaching and imply that it belongs to the named Father.",
    "- Prefer primary-source evidence over secondary summaries when providers disagree.",
    "- Distinguish the Father's own teaching from quotations, opponents, heresies, historical narration, and rhetorical objections.",
    "- Never invent quotations, work titles, references, columns, chapter numbers, homily numbers, or URLs.",
    "- A live PG OCR passage may contain recognition errors; translate cautiously.",
    "- Curated translations are evidence of the source text but are not original-language witnesses.",
    "- Web research is a discovery layer: verify attribution and provenance from the supplied source details before making a strong claim.",
    "- Bibliographic sources support historical/bibliographic claims, not direct quotations from the Father.",
    "- If evidence is insufficient for the exact claim requested, say so precisely.",
    "",
    ...contextParts,
  ].join("\n\n");
}

function finalize(
  contextParts: string[],
  sources: PatristicResearchSource[],
  providersAttempted: string[],
  providersSucceeded: string[],
): PatristicResearchContext {
  return {
    context: buildFinalContext(contextParts),
    sources: deduplicateSources(sources),
    providersAttempted,
    providersSucceeded,
  };
}

export async function buildPatristicResearchContext(
  query: string,
): Promise<PatristicResearchContext | null> {
  if (!shouldRunPatristicResearch(query)) return null;

  const providersAttempted: string[] = [];
  const providersSucceeded: string[] = [];
  const contextParts: string[] = [];
  const sources: PatristicResearchSource[] = [];
  const language = detectRetrievalLanguage(query);

  /*
   * Provider strategy:
   *
   * Never stop after the first match. A curated hit can be incomplete,
   * a DB hit can be semantically broad, and PG OCR can be noisy.
   * We aggregate independent evidence and let the answer model prefer
   * the strongest provenance.
   */
  const curatedDocuments = findCuratedPatristicDocuments(query);

  if (curatedDocuments.length > 0) {
    providersAttempted.push("CURATED_TEXT");

    try {
      const curated = await searchCuratedPatristicTexts(query, 5);
      if (curated.length > 0) {
        providersSucceeded.push("CURATED_TEXT");
        contextParts.push(formatCuratedContext(curated));
        sources.push(...mapCuratedSources(curated));
      }
    } catch (error) {
      console.error("PATRISTIC_RESEARCH_CURATED_ERROR:", error);
    }
  }

  let verifiedDbAuthor: string | undefined;

  try {
    verifiedDbAuthor = await detectPatristicAuthor(query);
  } catch (error) {
    console.error("PATRISTIC_AUTHOR_DETECTION_ERROR:", error);
  }

  if (verifiedDbAuthor || isGenericPatristicResearchQuery(query)) {
    providersAttempted.push("VERIFIED_DB");

    try {
      const verified = await buildVerifiedPatristicContext(query, language);
      if (verified) {
        providersSucceeded.push("VERIFIED_DB");
        contextParts.push(verified.context);
        sources.push(
          ...verified.sources.map((source) => ({
            provider: "VERIFIED_DB" as const,
            authorName: source.authorName,
            workTitle: source.workTitle,
            reference: source.reference,
            originalLanguage: source.originalLanguage,
            sourceUrl: source.sourceUrl,
            scanUrl: null,
            verificationStatus: source.verificationStatus,
          })),
        );
      }
    } catch (error) {
      console.error("PATRISTIC_RESEARCH_VERIFIED_DB_ERROR:", error);
    }
  }

  providersAttempted.push("PATROLOGIA_GRAECA");

  try {
    const livePg = await buildLivePgChatContext(query);
    if (livePg?.context) {
      providersSucceeded.push("PATROLOGIA_GRAECA");
      contextParts.push(livePg.context);
      sources.push(...mapPgSources(livePg.sources));
    }
  } catch (error) {
    console.error("PATRISTIC_RESEARCH_PG_ERROR:", error);
  }

  /*
   * Universal discovery provider.
   *
   * This removes the architectural dependency on hard-coded Fathers.
   * The local corpus and PG catalog remain high-confidence accelerators,
   * but an author who is absent from both can still be researched at
   * request time from primary and scholarly web sources.
   */
  providersAttempted.push("WEB_RESEARCH");

  try {
    const webResearch = await researchPatristicQuestionOnWeb(query);
    if (webResearch?.context) {
      providersSucceeded.push("WEB_RESEARCH");
      contextParts.push(webResearch.context);
      sources.push(
        ...webResearch.sources.map((source) => ({
          provider: "WEB_RESEARCH" as const,
          authorName: null,
          workTitle: source.title,
          reference: null,
          originalLanguage: null,
          sourceUrl: source.sourceUrl,
          scanUrl: null,
          verificationStatus: "LIVE_WEB_RESEARCH",
        })),
      );
    }
  } catch (error) {
    console.error("PATRISTIC_RESEARCH_WEB_ERROR:", error);
  }

  const result =
    contextParts.length > 0
      ? finalize(
          contextParts,
          sources,
          providersAttempted,
          providersSucceeded,
        )
      : null;

  console.log("PATRISTIC_RESEARCH:", {
    query,
    language,
    curatedMatch: curatedDocuments.length > 0,
    verifiedDbAuthor: verifiedDbAuthor ?? null,
    providersAttempted,
    providersSucceeded,
    sourceCount: result?.sources.length ?? 0,
  });

  return result;
}

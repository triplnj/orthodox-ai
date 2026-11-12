import { diagnostic, failureCategory } from "@/lib/diagnostics";
import {reviewedGregoryOpeningEvidence} from "./reviewed-gregory-evidence";
import { sourceBackedBibliographyContext } from "./source-backed-bibliography";
import { isUniversalBibliographyQuestion, resolveUniversalBibliography } from "./universal-bibliography-resolver";
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
import { discoverOfficialSaintLife } from "./discover-official-saint-life";
import { discoverOrthodoxWikiBibliography } from "./discover-orthodoxwiki-bibliography";

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
  webpageTitle?: string | null;
  originalSourceUrl?: string;
  metadata?: Record<string, unknown>;
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
    metadata: { pgVolume: source.pgVolume, scanPage: source.scanPage, pgReference: source.pgReference },
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
    metadata: { sourceName: item.sourceName, documentType: item.documentType, excerpt: item.excerpt },
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
    "- Additive source corpus: keep all existing verified and curated writings, including modern Orthodox saints, alongside Patrologia Graeca, Patrologia Latina when indexed, and Philokalia where available.",
    "- A directly relevant authentic work by the named author outranks an unrelated ancient excerpt, regardless of collection or publication date. Never exclude a nineteenth- or twentieth-century Father merely because PG and PL cover earlier centuries.",
    "- The retrieved corpus is NOT complete: no PL or Philokalia passage may be claimed unless it was actually retrieved and attributed.",
    "- These collections are historical editions/anthologies, not automatic critical editions or guarantees of authorship; note pseudepigraphy, editorial variants, and OCR damage.",
    "- SYNTHESIS METHOD: identify the exact author and question; read each relevant passage in its surrounding argument; distinguish what the author affirms, quotes, rejects or asks; compare independent passages; present the narrow conclusion supported by the evidence.",
    "- A passage about another topic or another Father is not evidence for the requested claim. A quotation matching text is not automatically the author\u0027s own position.",
    "- If primary text and secondary synopsis disagree, do not silently prefer the summary; disclose the conflict and preserve the primary passage\u0027s meaning.",
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
  onWaitingForSource?: () => void,
  currentQuestion: string = query,
): Promise<PatristicResearchContext | null> {
  // Narrow current-turn bibliographic questions use reviewed catalog evidence;
  // even non-saint contributors (e.g. an underlying source author) are eligible.
  // Unresolved authors and non-bibliographic topics keep existing retrieval.
  const bibliography = sourceBackedBibliographyContext(currentQuestion);
  if (bibliography) return bibliography;
  // General bibliographies require a work-role evidence ledger. Do not feed
  // unsorted biography and theology snippets to the answer model as proof.
  if (isUniversalBibliographyQuestion(currentQuestion)) {
    let discovered = null;
    try { discovered = await researchPatristicQuestionOnWeb(query, onWaitingForSource, "bibliography"); }
    catch (error) { diagnostic("operation_failed", { operation: "research", failure: failureCategory(error) }); }
    return resolveUniversalBibliography(currentQuestion, discovered);
  }
  if (!shouldRunPatristicResearch(query)) return null;
  // Guard on the CURRENT turn only; previous approved questions never authorize
  // unrelated new theological claims. No production schema or staging dependency.
  const reviewed = reviewedGregoryOpeningEvidence(currentQuestion);
  if (reviewed) return reviewed;

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
  const genericQuery = isGenericPatristicResearchQuery(query);

  // Independent retrieval providers run together. Web search is bounded by a\n  // nine-second abort budget; the other providers retain their results.\n  // Each provider handles its own
  // failure, preserving partial grounded evidence if another provider is unavailable.
  // Keep the final assembly in evidence-priority order, not completion order.
  const [curated, verified, livePg, webResearch, officialSaintLife, orthodoxWiki] = await Promise.all([
    (async () => {
      if (curatedDocuments.length === 0) return null;
      providersAttempted.push("CURATED_TEXT");
      try {
        return await searchCuratedPatristicTexts(query, 5);
      } catch (error) {
        diagnostic("operation_failed", { operation: "retrieval", failure: failureCategory(error) });
        return null;
      }
    })(),
    (async () => {
      try {
        const author = await detectPatristicAuthor(query);
        if (!author && !genericQuery) return null;
        providersAttempted.push("VERIFIED_DB");
        return await buildVerifiedPatristicContext(query, language);
      } catch (error) {
        diagnostic("operation_failed", { operation: "retrieval", failure: failureCategory(error) });
        return null;
      }
    })(),
    (async () => {
      providersAttempted.push("PATROLOGIA_GRAECA");
      try {
        return await buildLivePgChatContext(query);
      } catch (error) {
        diagnostic("operation_failed", { operation: "retrieval", failure: failureCategory(error) });
        return null;
      }
    })(),
    (async () => {
      providersAttempted.push("WEB_RESEARCH");
      try {
        return await researchPatristicQuestionOnWeb(query, onWaitingForSource);
      } catch (error) {
        diagnostic("operation_failed", { operation: "research", failure: failureCategory(error) });
        return null;
      }
    })(),
    (async () => {
      providersAttempted.push("OFFICIAL_SAINT_LIVES");
      try {
        return await discoverOfficialSaintLife(query);
      } catch (error) {
        diagnostic("operation_failed", { operation: "retrieval", failure: failureCategory(error) });
        return [];
      }
    })(),
    (async () => {
      providersAttempted.push("ORTHODOXWIKI");
      try { return await discoverOrthodoxWikiBibliography(query); }
      catch (error) { diagnostic("operation_failed", { operation: "retrieval", failure: failureCategory(error) }); return []; }
    })(),
  ]);

  // Additive federation: preserve curated editions, verified database passages,
  // PG scans, and live discovery. No corpus replaces or excludes another.
  // Source relevance, exact authorship, and passage context decide evidential weight.
  if (curated?.length) {
    providersSucceeded.push("CURATED_TEXT");
    contextParts.push(formatCuratedContext(curated));
    sources.push(...mapCuratedSources(curated));
  }
  if (verified) {
    providersSucceeded.push("VERIFIED_DB");
    contextParts.push(verified.context);
    sources.push(...verified.sources.map(source => ({
      provider: "VERIFIED_DB" as const,
      authorName: source.authorName,
      workTitle: source.workTitle,
      reference: source.reference,
      originalLanguage: source.originalLanguage,
      sourceUrl: source.sourceUrl,
      scanUrl: null,
      verificationStatus: source.verificationStatus,
      metadata: source.metadata,
    })));
  }
  if (livePg?.context) {
    providersSucceeded.push("PATROLOGIA_GRAECA");
    contextParts.push(livePg.context);
    sources.push(...mapPgSources(livePg.sources));
  }
  if (webResearch?.context) {
    providersSucceeded.push("WEB_RESEARCH");
    contextParts.push(webResearch.context);
    sources.push(...webResearch.sources.map(source => ({
      provider: "WEB_RESEARCH" as const,
      authorName: null,
      workTitle: null,
      webpageTitle: source.title,
      originalSourceUrl: source.originalSourceUrl,
      reference: null,
      originalLanguage: null,
      sourceUrl: source.sourceUrl,
      scanUrl: null,
      verificationStatus: "LIVE_WEB_RESEARCH",
    })));
  }

  if (officialSaintLife.length) {
    providersSucceeded.push("OFFICIAL_SAINT_LIVES");
    contextParts.push(formatCuratedContext(officialSaintLife));
    sources.push(...mapCuratedSources(officialSaintLife));
  }
  if (orthodoxWiki.length) {
    providersSucceeded.push("ORTHODOXWIKI");
    contextParts.push(formatCuratedContext(orthodoxWiki));
    sources.push(...mapCuratedSources(orthodoxWiki));
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

  diagnostic("operation_completed", { operation: "research", count: result?.sources.length ?? 0 });

  return result;
}

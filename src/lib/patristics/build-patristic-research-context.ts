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
  shouldRunPatristicResearch,
} from "./should-run-patristic-research";

export type PatristicResearchSource = {
  provider:
    | "VERIFIED_DB"
    | "CURATED_TEXT"
    | "PATROLOGIA_GRAECA";

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

  sources:
    PatristicResearchSource[];

  providersAttempted:
    string[];

  providersSucceeded:
    string[];
};

function detectRetrievalLanguage(
  query: string,
): PatristicLanguage {
  if (
    /\p{Script=Cyrillic}/u.test(
      query,
    )
  ) {
    return "sr";
  }

  const normalized =
    query.toLowerCase();

  if (
    /\b(sveti|svetog|svetom|duša|dusa|ikona|spasenje|vaskrsenje|molitva|post|greh|grijeh|greha|grehova)\b/.test(
      normalized,
    )
  ) {
    return "sr";
  }

  /*
   * The verified database currently stores
   * Serbian and English translations.
   * German and other Latin-script questions
   * may use English source translations as
   * retrieval context; final answer language
   * is handled by chatService.
   */
  return "en";
}

function mapPgSources(
  sources: LivePgSource[],
): PatristicResearchSource[] {
  return sources.map(
    (source) => ({
      provider:
        "PATROLOGIA_GRAECA",

      authorName:
        source.authorName,

      workTitle:
        null,

      reference:
        source.pgReference ??
        `PG ${source.pgVolume}, digital scan page ${source.scanPage}`,

      originalLanguage:
        "Greek",

      sourceUrl:
        source.sourceUrl,

      scanUrl:
        source.pageImageUrl,

      verificationStatus:
        "PRIMARY_SOURCE_OCR",
    }),
  );
}

function mapCuratedSources(
  evidence:
    CuratedTextEvidence[],
): PatristicResearchSource[] {
  return evidence.map(
    (item) => ({
      provider:
        "CURATED_TEXT",

      authorName:
        item.authorName,

      workTitle:
        item.workTitle,

      reference:
        null,

      originalLanguage:
        item.originalLanguage,

      sourceUrl:
        item.sourceUrl,

      scanUrl:
        null,

      verificationStatus:
        item.verificationStatus,
    }),
  );
}

function formatCuratedContext(
  evidence:
    CuratedTextEvidence[],
) {
  const blocks =
    evidence.map(
      (
        item,
        index,
      ) => [
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
      ].join("\n"),
    );

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

function deduplicateSources(
  sources:
    PatristicResearchSource[],
) {
  const seen =
    new Set<string>();

  return sources.filter(
    (source) => {
      const key = [
        source.provider,
        source.sourceUrl,
        source.scanUrl ?? "",
        source.reference ?? "",
      ].join(":");

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

function buildFinalContext(
  contextParts: string[],
) {
  return [
    "PATRISTIC RESEARCH CONTEXT",
    "",
    "Rules:",
    "- Attribute a specific teaching to a Church Father only when supported by the evidence below.",
    "- Do not replace missing evidence with generic Orthodox teaching and imply that it belongs to the named Father.",
    "- Distinguish the Father's own teaching from quotations, opponents, heresies, historical narration, and rhetorical objections.",
    "- Never invent quotations, work titles, references, columns, chapter numbers, homily numbers, or URLs.",
    "- A live PG OCR passage may contain recognition errors; translate cautiously.",
    "- Curated translations are evidence of the source text but are not original-language witnesses.",
    "- Bibliographic sources support historical/bibliographic claims, not direct quotations from the Father.",
    "- If evidence is insufficient for the exact claim requested, say so precisely.",
    "",
    ...contextParts,
  ].join("\n\n");
}

export async function buildPatristicResearchContext(
  query: string,
): Promise<
  PatristicResearchContext | null
> {
  /*
   * Cost gate:
   * ordinary prayer, fasting, Scripture, or
   * general spiritual-life questions must not
   * trigger patristic embeddings/LLM retrieval.
   */
  if (
    !shouldRunPatristicResearch(
      query,
    )
  ) {
    return null;
  }

  const providersAttempted:
    string[] = [];

  const providersSucceeded:
    string[] = [];

  const contextParts:
    string[] = [];

  const sources:
    PatristicResearchSource[] =
      [];

  const language =
    detectRetrievalLanguage(
      query,
    );

  /*
   * Provider 1:
   * multi-source verified database.
   *
   * If this succeeds, it is already the highest
   * confidence and cheapest evidence source, so
   * do not trigger lower-priority providers.
   */
  providersAttempted.push(
    "VERIFIED_DB",
  );

  try {
    const verified =
      await buildVerifiedPatristicContext(
        query,
        language,
      );

    if (verified) {
      providersSucceeded.push(
        "VERIFIED_DB",
      );

      contextParts.push(
        verified.context,
      );

      sources.push(
        ...verified.sources.map(
          (source) => ({
            provider:
              "VERIFIED_DB" as const,

            authorName:
              source.authorName,

            workTitle:
              source.workTitle,

            reference:
              source.reference,

            originalLanguage:
              source.originalLanguage,

            sourceUrl:
              source.sourceUrl,

            scanUrl:
              null,

            verificationStatus:
              source.verificationStatus,
          }),
        ),
      );

      const finalSources =
        deduplicateSources(
          sources,
        );

      return {
        context:
          buildFinalContext(
            contextParts,
          ),

        sources:
          finalSources,

        providersAttempted,

        providersSucceeded,
      };
    }
  } catch (error) {
    console.error(
      "PATRISTIC_RESEARCH_VERIFIED_DB_ERROR:",
      error,
    );
  }

  /*
   * Provider 2:
   * deterministic curated texts.
   *
   * This covers authoritative/public-domain
   * sources that are not naturally handled by PG,
   * including Syriac authors represented through
   * curated editions/translations.
   */
  providersAttempted.push(
    "CURATED_TEXT",
  );

  try {
    const curated =
      await searchCuratedPatristicTexts(
        query,
        5,
      );

    if (
      curated.length > 0
    ) {
      providersSucceeded.push(
        "CURATED_TEXT",
      );

      contextParts.push(
        formatCuratedContext(
          curated,
        ),
      );

      sources.push(
        ...mapCuratedSources(
          curated,
        ),
      );

      const finalSources =
        deduplicateSources(
          sources,
        );

      return {
        context:
          buildFinalContext(
            contextParts,
          ),

        sources:
          finalSources,

        providersAttempted,

        providersSucceeded,
      };
    }
  } catch (error) {
    console.error(
      "PATRISTIC_RESEARCH_CURATED_ERROR:",
      error,
    );
  }

  /*
   * Provider 3:
   * live Patrologia Graeca OCR retrieval.
   *
   * Used when higher-confidence/local providers
   * cannot answer the question.
   */
  providersAttempted.push(
    "PATROLOGIA_GRAECA",
  );

  try {
    const livePg =
      await buildLivePgChatContext(
        query,
      );

    if (livePg?.context) {
      providersSucceeded.push(
        "PATROLOGIA_GRAECA",
      );

      contextParts.push(
        livePg.context,
      );

      sources.push(
        ...mapPgSources(
          livePg.sources,
        ),
      );
    }
  } catch (error) {
    console.error(
      "PATRISTIC_RESEARCH_PG_ERROR:",
      error,
    );
  }

  const deduplicatedSources =
    deduplicateSources(
      sources,
    );

  console.log(
    "PATRISTIC_RESEARCH:",
    {
      query,
      language,
      providersAttempted,
      providersSucceeded,
      sourceCount:
        deduplicatedSources.length,
    },
  );

  if (
    contextParts.length === 0
  ) {
    return null;
  }

  return {
    context:
      buildFinalContext(
        contextParts,
      ),

    sources:
      deduplicatedSources,

    providersAttempted,

    providersSucceeded,
  };
}

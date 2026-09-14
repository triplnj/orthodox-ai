import {
  buildVerifiedPatristicContext,
  type PatristicLanguage,
} from "./build-chat-context";

import {
  buildLivePgChatContext,
  type LivePgSource,
} from "./build-live-pg-chat-context";

export type PatristicResearchSource = {
  provider:
    | "VERIFIED_DB"
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
   * can safely use English source translations
   * as retrieval context; final answer language
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

export async function buildPatristicResearchContext(
  query: string,
): Promise<
  PatristicResearchContext | null
> {
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
   * high-confidence, multi-source verified
   * passages already stored in our database.
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
    }
  } catch (error) {
    console.error(
      "PATRISTIC_RESEARCH_VERIFIED_DB_ERROR:",
      error,
    );
  }

  /*
   * Provider 2:
   * live Patrologia Graeca OCR retrieval.
   *
   * This is intentionally independent from
   * the verified DB provider. One provider
   * failing must not imply that no evidence
   * exists in another corpus.
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

  const context = [
    "PATRISTIC RESEARCH CONTEXT",
    "",
    "Rules:",
    "- Attribute a specific teaching to a Church Father only when supported by the evidence below.",
    "- Do not replace missing evidence with generic Orthodox teaching and imply that it belongs to the named Father.",
    "- Distinguish the Father's own teaching from quotations, opponents, heresies, historical narration, and rhetorical objections.",
    "- Never invent quotations, work titles, references, columns, chapter numbers, homily numbers, or URLs.",
    "- A live PG OCR passage may contain recognition errors; translate cautiously.",
    "- If evidence is insufficient for the exact claim requested, say so precisely.",
    "",
    ...contextParts,
  ].join("\n\n");

  return {
    context,

    sources:
      deduplicatedSources,

    providersAttempted,

    providersSucceeded,
  };
}

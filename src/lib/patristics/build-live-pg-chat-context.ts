    import {
  searchPgPassages,
  type PgPassageMatch,
} from "./pg-passage-search";


export type LivePgSource = {
  authorName: string;

  pgVolume: number;

  scanPage: number;

  pgReference: string | null;

  sourceUrl: string;

  pageImageUrl: string;
};


export type LivePgChatContext = {
  context: string;

  sources: LivePgSource[];
};


function cleanText(
  value: string,
) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}


function limitText(
  value: string,
  maxLength = 4500,
) {
  const cleaned =
    cleanText(value);

  if (
    cleaned.length <=
    maxLength
  ) {
    return cleaned;
  }

  return (
    cleaned.slice(
      0,
      maxLength,
    ) + "…"
  );
}


function uniqueSources(
  matches: PgPassageMatch[],
): LivePgSource[] {
  const seen =
    new Set<string>();

  const result:
    LivePgSource[] = [];

  for (
    const match of matches
  ) {
    const key =
      [
        match.pgVolume,
        match.scanPage,
        match.pageImageUrl,
      ].join(":");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      authorName:
        match.authorName,

      pgVolume:
        match.pgVolume,

      scanPage:
        match.scanPage,

      pgReference:
        null,

      sourceUrl:
        match.sourceUrl,

      pageImageUrl:
        match.pageImageUrl,
    });
  }

  return result;
}


function buildPassageBlock(
  match: PgPassageMatch,
  index: number,
) {
  const workTitles =
    match.candidateWorkTitles
      .filter(Boolean)
      .join(" / ");

  return `
PASSAGE ${index + 1}

Author:
${match.authorName}

PG volume:
PG ${match.pgVolume}

Scan page:
${match.scanPage}

Candidate work:
${workTitles || "Work not yet deterministically identified"}

Author -> PG volume verified:
${match.authorVolumeVerified ? "YES" : "NO"}

Matched Greek search terms:
${match.matchedTerms.join(", ")}

Greek OCR passage:
${limitText(match.originalText, 3500)}

Wider OCR context:
${limitText(match.contextText, 5000)}

PG digital volume:
${match.sourceUrl}

Exact scan page:
${match.pageImageUrl}
  `.trim();
}


export async function buildLivePgChatContext(
  query: string,
): Promise<
  LivePgChatContext | null
> {
  try {
    /*
     * Више кандидата него што ћемо
     * коначно приказати моделу.
     *
     * pg-passage-search већ ради:
     *
     * питање
     * → аутор
     * → PG том
     * → Greek stems
     * → OCR пасуси
     */
    const matches =
      await searchPgPassages(
        query,
        8,
      );

    if (
      matches.length === 0
    ) {
      return null;
    }

    /*
     * За сада користимо најбољих
     * пет резултата.
     *
     * Семантички reranking ћемо
     * касније унапредити, али
     * retrieval већ сада ради.
     */
    const selected =
      matches.slice(0, 5);

    const passages =
      selected
        .map(
          (
            match,
            index,
          ) =>
            buildPassageBlock(
              match,
              index,
            ),
        )
        .join(
          "\n\n--------------------\n\n",
        );

    const context = `
LIVE PATRISTIC SOURCE CONTEXT — PATRLOGIA GRAECA

The following material was retrieved directly from digitized
Patrologia Graeca volumes for the author's question.

IMPORTANT SOURCE RULES:

1. These are OCR transcriptions of real PG scan pages.
2. OCR may contain typographical recognition errors.
3. Never silently correct the Greek by inventing words.
4. Never invent a PG column number.
5. If PG column mapping is unavailable, cite only the PG volume
   and the scan-page link.
6. Do not claim that every retrieved passage expresses the author's
   own doctrine. Some passages may describe or refute another view.
7. Determine from the supplied context whether the author is:
   - teaching something,
   - quoting Scripture,
   - describing another school,
   - or refuting an opponent.
8. Answer the user's actual theological question using only passages
   that are genuinely relevant.
9. Translate the relevant Greek passage directly into the language
   of the user's question.
10. Do not pretend a translation is a pre-existing published translation.
    It is your direct translation from the supplied Greek OCR.
11. Never fabricate a quotation that does not appear in the supplied
    Greek source material.
12. If the OCR is too corrupt for a secure direct translation,
    paraphrase cautiously and explicitly say that the OCR is damaged.
13. The source links supplied below are mandatory evidence.
14. Internet Archive is only the digital carrier of the PG scan.
    The cited theological source is Patrologia Graeca.
15. Do NOT say that no patristic source is available when relevant
    PG passages are supplied here.

RETRIEVED PG PASSAGES:

${passages}
    `.trim();

    return {
      context,

      sources:
        uniqueSources(
          selected,
        ),
    };
  } catch (
    error
  ) {
    console.error(
      "LIVE_PG_CHAT_CONTEXT_ERROR:",
      error,
    );

    /*
     * PG retrieval не сме да
     * сруши цео OrthodoxAI chat.
     */
    return null;
  }
}
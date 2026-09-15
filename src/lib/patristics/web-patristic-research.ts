import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type WebPatristicResearchSource = {
  sourceUrl: string;
  title: string | null;
};

export type WebPatristicResearchResult = {
  context: string;
  sources: WebPatristicResearchSource[];
};

function collectUrlCitations(response: unknown) {
  const urls = new Map<string, string | null>();
  const value = response as {
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        annotations?: Array<{
          type?: string;
          url?: string;
          title?: string;
          url_citation?: {
            url?: string;
            title?: string;
          };
        }>;
      }>;
      action?: {
        sources?: Array<{
          type?: string;
          url?: string;
        }>;
      };
    }>;
  };

  for (const item of value.output ?? []) {
    for (const annotation of item.content?.flatMap((part) => part.annotations ?? []) ?? []) {
      const url = annotation.url_citation?.url ?? annotation.url;
      const title = annotation.url_citation?.title ?? annotation.title ?? null;
      if (url && /^https?:\/\//i.test(url)) {
        urls.set(url, title);
      }
    }

    for (const source of item.action?.sources ?? []) {
      if (source.url && /^https?:\/\//i.test(source.url)) {
        if (!urls.has(source.url)) {
          urls.set(source.url, null);
        }
      }
    }
  }

  return [...urls.entries()].map(([sourceUrl, title]) => ({
    sourceUrl,
    title,
  }));
}

function collectUrlsFromText(text: string) {
  const urls = text.match(/https?:\/\/[^\s)\]}>"']+/g) ?? [];
  return [...new Set(urls)].map((sourceUrl) => ({
    sourceUrl,
    title: null as string | null,
  }));
}

function deduplicateSources(sources: WebPatristicResearchSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.sourceUrl)) return false;
    seen.add(source.sourceUrl);
    return true;
  });
}

export async function researchPatristicQuestionOnWeb(
  query: string,
): Promise<WebPatristicResearchResult | null> {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
      },
    ],
    input: [
      {
        role: "system",
        content: `You are a source-retrieval researcher for an Orthodox Christian patristics application.

Research the user's exact question about a named Church Father or patristic work. Your task is evidence retrieval, not devotional exposition.

Priority order:
1. Primary-source text of the named Father in a reputable digital edition or scan.
2. Patrologia Graeca / Patrologia Latina scans or reliable transcriptions.
3. Established scholarly or ecclesiastical repositories containing the work.
4. High-quality secondary scholarship only when primary material is insufficient.

Rules:
- Do not substitute another Father simply because the theology is similar.
- Verify that every cited passage really belongs to the named author/work.
- Distinguish the Father's own teaching from quotations, opponents, heresies, and editorial introductions.
- Prefer exact work titles and stable source URLs.
- Never invent PG/PL columns, chapter numbers, homily numbers, or quotations.
- If exact wording cannot be securely established, provide a careful paraphrase and say that it is a paraphrase.
- Search across language variants of the author's name and relevant theological terminology when needed.
- Return a compact research dossier that includes: identified author, relevant works/passages, what each passage supports, source provenance, and direct source URLs.
- Keep quotations short; the downstream answer model will synthesize the final response.
- If evidence is weak or contradictory, state that explicitly.`
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  const context = response.output_text?.trim();
  if (!context) return null;

  const sources = deduplicateSources([
    ...collectUrlCitations(response),
    ...collectUrlsFromText(context),
  ]);

  return {
    context: [
      "LIVE WEB PATRISTIC RESEARCH CONTEXT",
      "",
      "This material was gathered at request time with web search.",
      "Treat it as research evidence, not as automatically verified primary-source text.",
      "Prefer primary-source passages and source provenance over secondary summaries.",
      "Do not invent references not present in this dossier.",
      "",
      context,
    ].join("\n"),
    sources,
  };
}

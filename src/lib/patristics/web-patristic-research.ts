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

/*
 * High-confidence repositories used for the first research pass.
 *
 * This is deliberately a SOURCE index, not an AUTHOR index. The
 * patristic engine must work for Fathers who have never been added
 * to our local corpus.
 */
const PREFERRED_PATRISTIC_DOMAINS = [
  "newadvent.org",
  "ccel.org",
  "bkv.unifr.ch",
  "archive.org",
  "perseus.tufts.edu",
  "perseids.org",
  "tertullian.org",
  "documentacatholicaomnia.eu",
  "books.google.com",
  "jstor.org",
  "cambridge.org",
  "oup.com",
  "academic.oup.com",
  "degruyter.com",
  "brill.com",
];

const BLOCKED_SOURCE_DOMAINS = [
  "dokumen.pub",
  "pdfcoffee.com",
  "scribd.com",
  "studylib.net",
  "historicalchristian.faith",
];

function hostnameMatches(
  hostname: string,
  domain: string,
) {
  return (
    hostname === domain ||
    hostname.endsWith(`.${domain}`)
  );
}

function normalizeSourceUrl(
  rawUrl: string,
): string | null {
  const cleaned = rawUrl
    .trim()
    .replace(/[\])}>.,;!?]+$/g, "");

  if (!/^https?:\/\//i.test(cleaned)) {
    return null;
  }

  try {
    const url = new URL(cleaned);

    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(
          key.toLowerCase(),
        )
      ) {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

function sourceScore(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      BLOCKED_SOURCE_DOMAINS.some((domain) =>
        hostnameMatches(hostname, domain),
      )
    ) {
      return -100;
    }

    if (
      PREFERRED_PATRISTIC_DOMAINS.some((domain) =>
        hostnameMatches(hostname, domain),
      )
    ) {
      return 100;
    }

    if (
      hostname.endsWith(".edu") ||
      hostname.includes(".edu.") ||
      hostname.includes(".ac.")
    ) {
      return 80;
    }

    if (
      hostname.endsWith(".gov") ||
      hostname.endsWith(".org")
    ) {
      return 45;
    }

    return 20;
  } catch {
    return -100;
  }
}

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
    for (
      const annotation of
      item.content?.flatMap(
        (part) => part.annotations ?? [],
      ) ?? []
    ) {
      const rawUrl =
        annotation.url_citation?.url ??
        annotation.url;
      const title =
        annotation.url_citation?.title ??
        annotation.title ??
        null;
      const url = rawUrl
        ? normalizeSourceUrl(rawUrl)
        : null;

      if (url) {
        urls.set(url, title);
      }
    }

    for (const source of item.action?.sources ?? []) {
      const url = source.url
        ? normalizeSourceUrl(source.url)
        : null;

      if (url && !urls.has(url)) {
        urls.set(url, null);
      }
    }
  }

  return [...urls.entries()].map(
    ([sourceUrl, title]) => ({
      sourceUrl,
      title,
    }),
  );
}

function collectUrlsFromText(text: string) {
  const urls =
    text.match(/https?:\/\/[^\s)\]}>"']+/g) ?? [];

  return [
    ...new Set(
      urls
        .map(normalizeSourceUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].map((sourceUrl) => ({
    sourceUrl,
    title: null as string | null,
  }));
}

function selectSources(
  sources: WebPatristicResearchSource[],
) {
  const byUrl = new Map<
    string,
    WebPatristicResearchSource
  >();

  for (const source of sources) {
    const normalized = normalizeSourceUrl(
      source.sourceUrl,
    );

    if (!normalized) continue;

    const score = sourceScore(normalized);
    if (score < 0) continue;

    const existing = byUrl.get(normalized);
    if (!existing || (!existing.title && source.title)) {
      byUrl.set(normalized, {
        sourceUrl: normalized,
        title: source.title,
      });
    }
  }

  const ranked = [...byUrl.values()].sort(
    (a, b) =>
      sourceScore(b.sourceUrl) -
      sourceScore(a.sourceUrl),
  );

  const strong = ranked.filter(
    (source) => sourceScore(source.sourceUrl) >= 80,
  );

  /*
   * When strong primary/academic evidence exists, do not expose
   * weaker aggregators in the evidence UI merely because the web
   * search happened to inspect them during discovery.
   */
  if (strong.length >= 2) {
    return strong.slice(0, 6);
  }

  return ranked.slice(0, 6);
}

const RESEARCH_SYSTEM_PROMPT = `You are a source-retrieval researcher for an Orthodox Christian patristics application.

Research the user's exact question about a named Church Father or patristic work. Your task is evidence retrieval, not devotional exposition.

Priority order:
1. Primary-source text of the named Father in a reputable digital edition or scan.
2. Patrologia Graeca / Patrologia Latina scans or reliable transcriptions.
3. Established scholarly or ecclesiastical repositories containing the work.
4. Peer-reviewed or university-press scholarship only when primary material is insufficient.

SOURCE QUALITY RULES:
- Do not rely on anonymous download sites, document mirrors, content farms, AI-generated pages, apologetic aggregation sites, or pages without clear textual provenance.
- A search result may be useful for discovery without being suitable as evidence. Exclude weak discovery-only sources from the research dossier.
- Prefer university, library, critical-edition, established patristic repository, major scholarly publisher, or stable primary-text sources.
- If both a weak mirror and a reputable edition contain the same material, use the reputable edition only.

ATTRIBUTION RULES:
- Do not substitute another Father simply because the theology is similar.
- Verify that every cited passage really belongs to the named author/work.
- Distinguish the Father's own teaching from quotations, opponents, heresies, and editorial introductions.
- Prefer exact work titles and stable source URLs.
- Never invent PG/PL columns, chapter numbers, homily numbers, or quotations.
- If exact wording cannot be securely established, provide a careful paraphrase and say that it is a paraphrase.
- Search across language variants of the author's name and relevant theological terminology when needed.
- Return a compact research dossier that includes: identified author, relevant works/passages, what each passage supports, source provenance, and direct source URLs.
- Keep quotations short; the downstream answer model will synthesize the final response.
- If evidence is weak or contradictory, state that explicitly.`;

async function runResearch(
  query: string,
  allowedDomains?: string[],
) {
  return openai.responses.create({
    model: "gpt-5-mini",
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        ...(allowedDomains
          ? {
              filters: {
                allowed_domains: allowedDomains,
              },
            }
          : {}),
      },
    ],
    input: [
      {
        role: "system",
        content: RESEARCH_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });
}

function buildResult(response: unknown) {
  const typed = response as {
    output_text?: string;
  };

  const context = typed.output_text?.trim();
  if (!context) return null;

  const sources = selectSources([
    ...collectUrlCitations(response),
    ...collectUrlsFromText(context),
  ]);

  if (sources.length === 0) {
    return null;
  }

  return {
    context,
    sources,
  };
}

export async function researchPatristicQuestionOnWeb(
  query: string,
): Promise<WebPatristicResearchResult | null> {
  /*
   * Pass 1: search a broad but curated set of reputable patristic,
   * library, edition and academic domains. This solves the common
   * case without letting low-quality mirrors into the evidence set.
   */
  const preferredResponse = await runResearch(
    query,
    PREFERRED_PATRISTIC_DOMAINS,
  );

  let result = buildResult(preferredResponse);

  /*
   * Pass 2: only when the curated-domain search finds no usable
   * evidence, widen discovery to the public web. The same quality
   * gate still filters what can become downstream evidence.
   */
  if (!result) {
    const broadResponse = await runResearch(query);
    result = buildResult(broadResponse);
  }

  if (!result) return null;

  return {
    context: [
      "LIVE WEB PATRISTIC RESEARCH CONTEXT",
      "",
      "This material was gathered at request time with web search.",
      "A source-quality gate has already removed blocked and low-provenance evidence URLs.",
      "Treat this as research evidence, not as automatically verified primary-source text.",
      "Prefer primary-source passages and source provenance over secondary summaries.",
      "Do not invent references not present in this dossier.",
      "",
      result.context,
    ].join("\n"),
    sources: result.sources,
  };
}

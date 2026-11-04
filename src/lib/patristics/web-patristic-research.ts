import { getOpenAI } from "@/lib/ai/openaiClient";
import { diagnostic, failureCategory } from "@/lib/diagnostics";



export type WebPatristicResearchSource = {
  sourceUrl: string;
  title: string | null;
  originalSourceUrl?: string;
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
  // Canonical Orthodox ecclesial sources and text libraries first.
  "oca.org",
  "goarch.org",
  "svetosavlje.org",
  "myriobiblos.gr",
  "apostoliki-diakonia.gr",
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
  const urls = new Map<string, { title: string | null; originalSourceUrl: string }>();
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
        urls.set(url, { title, originalSourceUrl: rawUrl! });
      }
    }

    // Web-search action.sources lists pages inspected during discovery,
    // NOT pages proving an assertion in the final evidence dossier.
    // Exposing all of them created misleading source cards for namesakes.
    // Only explicit URL citations (above) or dossier references (below)
    // are eligible for display.

  }

  return [...urls.entries()].map(
    ([sourceUrl, metadata]) => ({
      sourceUrl,
      ...metadata,
    }),
  );
}

function collectUrlsFromText(text: string) {
  const urls =
    text.match(/https?:\/\/[^\s)\]}>"']+/g) ?? [];

  return [...new Set(urls)].flatMap(originalSourceUrl => {
    const sourceUrl = normalizeSourceUrl(originalSourceUrl);
    return sourceUrl ? [{ sourceUrl, originalSourceUrl,
    title: null as string | null,
    }] : [];
  });
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
        originalSourceUrl: source.originalSourceUrl ?? source.sourceUrl,
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

Research the user's exact question about Orthodox saints, Church Fathers, patristic authors, Orthodox historical movements, or a patristic work. For questions about a saint and their writings, find both biography and a reliable bibliography; a biography alone does not establish an author's bibliography. For questions in Serbian (Cyrillic or Latin), Bulgarian, Greek, or other languages, translate the topic into English search terms, and run English-language searches alongside the original-language searches. Search synonyms and relevant everyday phrasing, not only exact technical vocabulary. If the question references earlier context, infer the topic from the supplied follow-up. Your task is evidence retrieval, not devotional exposition. If the user requests any Church Father without naming one, select a Father ONLY when you find an actual relevant passage in an attributable work; search for the topic in primary patristic texts. Do not require a named author in the question.

Search transliterations in Serbian Cyrillic, Serbian Latin and English, including surname spelling variants. Prioritize official Orthodox institutions such as oca.org, spc.rs and svetosavlje.org but search other established sources if none is found. Always run a real live search; do not answer from memory alone.

Priority order:
1. Primary-source text of the named Father, or of a suitably evidenced Father when none was named, in a reputable digital edition or scan.
2. Patrologia Graeca / Patrologia Latina scans or reliable transcriptions.
3. Established scholarly or ecclesiastical repositories containing the work.
4. Peer-reviewed or university-press scholarship only when primary material is insufficient.

SOURCE QUALITY RULES:
- Do not rely on anonymous download sites, document mirrors, content farms, AI-generated pages, apologetic aggregation sites, or pages without clear textual provenance.
- A search result may be useful for discovery without being suitable as evidence. Exclude weak discovery-only sources from the research dossier.
- Prefer university, library, critical-edition, established patristic repository, major scholarly publisher, or stable primary-text sources.
- If both a weak mirror and a reputable edition contain the same material, use the reputable edition only.

ATTRIBUTION RULES:
- If a Father is named, do not substitute another Father simply because the theology is similar. If no Father is named, identify the Father selected and give the exact work and passage you actually found.
- Verify that every cited passage really belongs to the named author/work.
- Distinguish the Father's own teaching from quotations, opponents, heresies, and editorial introductions.
- Prefer exact work titles and stable source URLs.
- Never invent PG/PL columns, chapter numbers, homily numbers, or quotations.
- If exact wording cannot be securely established, provide a careful paraphrase and say that it is a paraphrase.
- Search across language variants of the author's name and relevant theological terminology when needed.
- If a work's authenticity or attribution is disputed, uncertain, pseudonymous, interpolated, or only traditionally attributed, state that explicitly.
- Do not silently use a disputed or pseudo-epigraphic text as evidence for the named Father's own teaching.

CLAIM-EVIDENCE LEDGER:
- Organize the useful findings as a compact evidence ledger, with one substantive claim per entry.
- For every claim include all of the following fields:
  CLAIM: the narrow proposition the source actually supports.
  EVIDENCE_TYPE: PRIMARY_TEXT, PRIMARY_TRANSLATION, SECONDARY_SCHOLARSHIP, or ATTRIBUTED_OR_DISPUTED.
  WORK: the exact work title supported by the source.
  PASSAGE_OR_REFERENCE: the exact homily, chapter, catechesis, section, PG/PL reference, or other locator only when it is actually established by the source; otherwise write "not securely established".
  SUPPORT_SCOPE: one sentence explaining exactly what the passage/source supports and what should not be inferred beyond it.
  SOURCE_URL: the direct source URL actually used.
- Do not include a claim in the ledger unless at least one cited source directly supports it.
- Do not turn general background knowledge into a source-backed claim.
- Do not infer a second doctrine from a passage that only establishes the first.
- Keep claims narrow enough that the downstream answer model can safely trace each final statement to evidence.
- If the evidence is secondary only, say so in EVIDENCE_TYPE and SUPPORT_SCOPE.
- If authenticity is disputed, use ATTRIBUTED_OR_DISPUTED and explain the uncertainty in SUPPORT_SCOPE.

Return a compact dossier containing the identified author, the claim-evidence ledger, source provenance, and direct source URLs. When the user requests a short post or reflection, retrieve source evidence rather than drafting that post yourself; the downstream model will write it.
Keep quotations short; the downstream answer model will synthesize the final response.
If evidence is weak or contradictory, state that explicitly.`;

// A deliberately short source discovery task runs before full answer synthesis.
// Long-form theological analysis happens only after verified links are found.
const FAST_RESEARCH_SYSTEM_PROMPT = `Find real primary, official Orthodox, or scholarly web sources for the user's question.
You MUST use web search. Search Serbian, Russian, and English spellings of a named saint when useful.
For questions about a saint's life and published writings, locate at least one biography
and one reliable bibliography if available. Do not guess authors or titles.
Return a BRIEF factual evidence note (maximum 350 words) with titles, key supported
facts and source URLs. Distinguish primary texts from biographies and bibliographies.
Never invent a source, URL, author attribution, or quotation. If sources disagree,
state the uncertainty. You are retrieving evidence, not composing a pastoral essay.`;
const WEB_RESEARCH_WAIT_NOTICE_MS = 19000;
const WEB_RESEARCH_DEADLINE_MS = 45000;

async function runResearch(
  query: string,
  allowedDomains: string[] | undefined,
  signal: AbortSignal,
) {
  return getOpenAI().responses.create({
    model: "gpt-4.1-mini",
    max_output_tokens: 1000,
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
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
        content: FAST_RESEARCH_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: query,
      },
    ],
  }, { signal, maxRetries: 0, timeout: WEB_RESEARCH_DEADLINE_MS });
}

function buildResult(response: unknown) {
  const typed = response as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  const context = (typed.output_text ?? typed.output?.flatMap(item => item.content ?? []).filter(part => part.type === "output_text").map(part => part.text ?? "").join("\n") ?? "").trim();
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
  onWaitingForSource?: () => void,
): Promise<WebPatristicResearchResult | null> {
  // Mandatory, unfiltered OpenAI API web search. Source quality is
  // enforced after discovery rather than preventing broad discovery.
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_RESEARCH_DEADLINE_MS);
  const waitingNotice = setTimeout(() => {
    if (!controller.signal.aborted) onWaitingForSource?.();
  }, WEB_RESEARCH_WAIT_NOTICE_MS);
  try {
    const response = await runResearch(query, undefined, controller.signal);
    const result = buildResult(response);
    diagnostic("operation_completed", { operation: "discovery", count: result?.sources.length ?? 0, durationMs: Date.now() - startedAt });

  if (!result) return null;

  return {
    context: [
      "LIVE WEB PATRISTIC RESEARCH CONTEXT",
      "",
      "This material was gathered at request time with web search.",
      "A source-quality gate has already removed blocked and low-provenance evidence URLs.",
      "The dossier is organized for claim-level grounding: final claims should stay within the SUPPORT_SCOPE of the corresponding evidence entry.",
      "Treat this as research evidence, not as automatically verified primary-source text.",
      "Prefer primary-source passages and source provenance over secondary summaries.",
      "Do not invent references not present in this dossier.",
      "",
      result.context,
    ].join("\n"),
    sources: result.sources,
  };
  } catch (error) {
    diagnostic("operation_failed", { operation: "discovery", failure: controller.signal.aborted ? "timeout" : failureCategory(error), durationMs: Date.now() - startedAt });
    return null;
  } finally {
    clearTimeout(timeout);
    clearTimeout(waitingNotice);
  }
}

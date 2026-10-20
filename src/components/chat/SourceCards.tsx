import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";

function safeLink(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : undefined; }
  catch { return undefined; }
}
const sourceLabels: Record<string, string> = {
  VERIFIED_DB: "Verified source collection", CURATED_TEXT: "Curated text", PATROLOGIA_GRAECA: "Patrologia Graeca OCR",
  WEB_RESEARCH: "General web research", PRIMARY_SOURCE_OCR: "Primary source OCR", LIVE_WEB_RESEARCH: "Live web research",
};
export function SourceCards({ sources }: { sources: PatristicResearchSource[] }) {
  if (!sources.length) return null;
  return <section aria-label="Sources for this answer" className="mt-4 border-t border-gray-200 pt-3 text-sm [overflow-wrap:anywhere]">
    <p className="font-semibold">Sources supplied for this answer</p>
    <ul className="space-y-2">{sources.map((source, index) => {
      const label = [source.authorName, source.workTitle ?? source.webpageTitle, source.reference].filter(Boolean).join(" — ") || "Patristic research source";
      const url = safeLink(source.scanUrl ?? source.originalSourceUrl ?? source.sourceUrl);
      return <li key={`${source.sourceUrl}-${index}`} className="mt-2 rounded border border-gray-200 p-2">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline">{label}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{label}</span>}
        <p>{sourceLabels[source.provider] ?? source.provider} · {sourceLabels[source.verificationStatus] ?? source.verificationStatus}{source.originalLanguage ? ` · ${source.originalLanguage}` : ""}</p>
      </li>;
    })}</ul>
    <p className="mt-2 text-gray-500">Source cards preserve retrieved references; they do not assert that every claim was independently verified.</p>
  </section>;
}

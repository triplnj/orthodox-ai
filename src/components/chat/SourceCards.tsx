import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";

function safeLink(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : undefined; }
  catch { return undefined; }
}
const sourceLabels: Record<string, string> = {
  VERIFIED_DB: "Verified source collection", CURATED_TEXT: "Curated text", PATROLOGIA_GRAECA: "Patrologia Graeca OCR",
  WEB_RESEARCH: "General web research", PRIMARY_SOURCE_OCR: "Primary source OCR", LIVE_WEB_RESEARCH: "Live web research",
};
type MappedSource = PatristicResearchSource & { claimMappings?: { claim: string; evidenceQuote: string; reviewStatus: string }[] };
export function SourceCards({ sources }: { sources: MappedSource[] }) {
  if (!sources.length) return null;
  return <section aria-label="Sources for this answer" className="mt-4 border-t border-gray-200 pt-3 text-sm [overflow-wrap:anywhere]">
    <p className="font-semibold">Sources supplied for this answer</p>
    <ul className="space-y-2">{sources.map((source, index) => {
      const label = [source.authorName, source.workTitle ?? source.webpageTitle, source.reference].filter(Boolean).join(" — ") || "Patristic research source";
      const url = safeLink(source.scanUrl ?? source.originalSourceUrl ?? source.sourceUrl);
      return <li key={`${source.sourceUrl}-${index}`} className="mt-2 rounded border border-gray-200 p-2">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline">{label}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{label}</span>}
        {(source.claimMappings ?? []).map((mapping, claimIndex) => <div key={claimIndex} className="mt-2 border-l-2 border-gray-300 pl-3 text-xs">
          <p><strong>Automated text match — interpretation not independently verified:</strong> {mapping.claim}</p>
          <p className="mt-1 italic">Source excerpt: “{mapping.evidenceQuote}”</p>
        </div>)}
        {!(source.claimMappings ?? []).length && <p className="mt-2 text-xs text-gray-500">Additional retrieved passage. No specific claim in this answer was linked to a matching excerpt.</p>}
        <p>{sourceLabels[source.provider] ?? source.provider} · {sourceLabels[source.verificationStatus] ?? source.verificationStatus}{source.originalLanguage ? ` · ${source.originalLanguage}` : ""}</p>
      </li>;
    })}</ul>
    <p className="mt-2 text-gray-500">An automated excerpt match verifies wording within the retrieved source. These matches do not assert that the theological meaning, dialogue speaker, or permission for direct quotation has been independently verified.</p>
  </section>;
}

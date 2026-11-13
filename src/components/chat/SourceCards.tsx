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
type SourceGroup = { source: MappedSource; bibliography: MappedSource[] };
export function SourceCards({ sources }: { sources: MappedSource[] }) {
  if (!sources.length) return null;
  // Bibliographic records describe individual work-role assertions, not textual
  // excerpts. Show each URL once while retaining its distinct supported works.
  const groups: SourceGroup[] = [];
  const bibliographyUrls = new Map<string, SourceGroup>();
  for (const source of sources) {
    if (source.metadata?.bibliographyCatalog === true) {
      const url = safeLink(source.sourceUrl) ?? source.sourceUrl;
      let group = bibliographyUrls.get(url);
      if (!group) {
        group = { source, bibliography: [] };
        bibliographyUrls.set(url, group);
        groups.push(group);
      }
      if (!group.bibliography.some(entry => entry.metadata?.evidenceId === source.metadata?.evidenceId))
        group.bibliography.push(source);
    } else groups.push({ source, bibliography: [] });
  }
  return <section aria-label="Sources for this answer" className="mt-4 border-t border-gray-200 pt-3 text-sm [overflow-wrap:anywhere]">
    <p className="font-semibold">Sources supplied for this answer</p>
    <ul className="space-y-2">{groups.map(({ source, bibliography }, index) => {
      const isBibliography = bibliography.length > 0;
      const isLiveBibliography = bibliography.some(item => item.verificationStatus === "LIVE_BIBLIOGRAPHY_EXCERPT_MATCH");
      const isProvisionalGraph = bibliography.some(item => item.metadata?.graphRecord === true || item.metadata?.editorialReview === false);
      const isReviewedBibliography = isBibliography && !isLiveBibliography && !isProvisionalGraph;
      const label = isBibliography ? (source.webpageTitle ?? (isReviewedBibliography ? "Reviewed bibliography source" : "Bibliographic reference")) :
        [source.authorName, source.workTitle ?? source.webpageTitle, source.reference].filter(Boolean).join(" — ") || "Patristic research source";
      const url = safeLink(source.scanUrl ?? source.originalSourceUrl ?? source.sourceUrl);
      return <li key={`${source.sourceUrl}-${index}`} className="mt-2 rounded border border-gray-200 p-2">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline">{label}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{label}</span>}
        {isBibliography ? <>
          <p className="mt-1 text-xs text-gray-600">{isLiveBibliography ? "Automatically extracted bibliographic claims with verbatim source-text matches; roles and relationships have NOT been independently editorially verified." : isProvisionalGraph ? "External bibliography index or source-crosschecked metadata; author roles and work relationships have NOT been independently editorially verified." : "Reviewed bibliographic attribution records; these are metadata, not verbatim text excerpts or automated matches to every sentence of the answer."}</p>
          <ul className="mt-2 space-y-1">{bibliography.map((item, evidenceIndex) =>
            <li key={String(item.metadata?.evidenceId ?? evidenceIndex)} className="border-l-2 border-gray-300 pl-3 text-xs">
              <strong>{item.workTitle}</strong> — {Array.isArray(item.metadata?.roles) ? item.metadata.roles.join(", ") : "attribution"}
              {typeof item.metadata?.parentWorkTitle === "string" ? ` (part of / based on: ${item.metadata.parentWorkTitle})` : ""}
              {typeof item.metadata?.supportingStatement === "string" ? `: ${item.metadata.supportingStatement}` : ""}
              {typeof item.metadata?.evidenceQuote === "string" ? <p className="mt-1 italic">Source text matched: “{item.metadata.evidenceQuote}”</p> : null}
            </li>)}</ul>
        </> : <>
          {(source.claimMappings ?? []).map((mapping, claimIndex) => <div key={claimIndex} className="mt-2 border-l-2 border-gray-300 pl-3 text-xs">
            <p><strong>Automated text match — interpretation not independently verified:</strong> {mapping.claim}</p>
            <p className="mt-1 italic">Source excerpt: “{mapping.evidenceQuote}”</p>
          </div>)}
          {!(source.claimMappings ?? []).length && <p className="mt-2 text-xs text-gray-500">Additional retrieved passage. No specific claim in this answer was linked to a matching excerpt.</p>}
        </>}
        <p className="mt-2 text-xs text-gray-500">{isBibliography ? (isLiveBibliography ? "Automated source-text match — bibliographic interpretation unreviewed" : isProvisionalGraph ? "External bibliographic metadata — independent review pending" : "Reviewed bibliographic attribution") :
          `${sourceLabels[source.provider] ?? source.provider} · ${sourceLabels[source.verificationStatus] ?? source.verificationStatus}${source.originalLanguage ? ` · ${source.originalLanguage}` : ""}`}</p>
      </li>;
    })}</ul>
    <p className="mt-2 text-gray-500">An automated excerpt match verifies wording within a retrieved source. These matches do not assert that the theological meaning, dialogue speaker, or permission for direct quotation has been independently verified. Bibliographic metadata documents cataloged work-role relations, not independent verification of every claim in the generated answer.</p>
  </section>;
}

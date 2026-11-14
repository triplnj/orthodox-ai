import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined;
  } catch { return undefined; }
}

type MappedSource = PatristicResearchSource & {
  claimMappings?: { claim: string; evidenceQuote: string; reviewStatus: string }[];
};
type SourceGroup = { source: MappedSource; bibliography: MappedSource[] };

export function SourceCards({ sources }: { sources: MappedSource[] }) {
  // The complete source list is displayed even when the answer-to-excerpt
  // matcher is unavailable; a retrieval reference is not a verified citation.
  const groups: SourceGroup[] = [];
  const byUrl = new Map<string, SourceGroup>();
  for (const source of sources) {
    const key = source.scanUrl ?? source.originalSourceUrl ?? source.sourceUrl;
    let group = byUrl.get(key);
    if (!group) {
      group = { source, bibliography: [] };
      groups.push(group);
      byUrl.set(key, group);
    }
    if (source.metadata?.bibliographyCatalog === true &&
      !group.bibliography.some(item => item.metadata?.evidenceId === source.metadata?.evidenceId))
      group.bibliography.push(source);
  }

  return <section aria-label="Sources for this answer" className="mt-4 border-t border-gray-200 pt-3 text-sm [overflow-wrap:anywhere]">
    <p className="font-semibold">Sources</p>
    {groups.length ? <ol className="mt-2 list-decimal space-y-2 pl-6">
      {groups.map(({ source, bibliography }, index) => {
        const url = safeLink(source.scanUrl ?? source.originalSourceUrl ?? source.sourceUrl);
        // Never invent a source title. An untitled discovery URL must be
        // visibly identified as such rather than masquerading as a citation.
        const fallbackLabel = url ? `Untitled reference — ${new URL(url).hostname}${new URL(url).pathname}` : "Untitled reference";
        const label = bibliography.length
          ? (source.webpageTitle ?? source.workTitle ?? fallbackLabel)
          : [source.authorName, source.workTitle ?? source.webpageTitle, source.reference]
            .filter(Boolean).join(" — ") || fallbackLabel;
        return <li key={url ?? `source-${index}`} className="pl-1">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{label}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{label}</span>}
          {bibliography.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">
            {bibliography.map((item, i) => <li key={String(item.metadata?.evidenceId ?? i)}>
              <strong>{item.workTitle}</strong>
              {Array.isArray(item.metadata?.roles) ? ` — ${item.metadata.roles.join(", ")}` : ""}
              {typeof item.metadata?.parentWorkTitle === "string" ? ` (part of: ${item.metadata.parentWorkTitle})` : ""}
            </li>)}
          </ul>}
        </li>;
      })}
    </ol> : <p className="mt-2 text-gray-600">No external source was retrieved for this answer.</p>}
    {groups.length > 0 && <p className="mt-2 text-xs text-gray-500">Listed references were retrieved during research. Their presence does not independently verify every assertion in the answer.</p>}
  </section>;
}

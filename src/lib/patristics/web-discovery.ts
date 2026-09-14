export type PatristicDiscoveryRequest = {
  query: string;
  language: "sr" | "en";
};

export type PatristicDiscoveryCandidate = {
  authorName: string | null;
  workTitle: string | null;
  originalLanguage: string | null;
  originalText: string;
  sourceUrl: string;
  sourceName: string | null;
  translationSr: string | null;
  translationEn: string | null;
};

/*
 * Legacy public-web patristic discovery is intentionally disabled.
 *
 * It previously used an expensive model together with
 * web_search_preview and could generate repeated paid calls through
 * background workflows. Production patristic research must use the
 * deterministic provider pipeline instead.
 *
 * Keeping this function preserves compatibility with older callers
 * while guaranteeing that they cannot trigger paid autonomous web
 * discovery.
 */
export async function discoverPatristicSources(
  request:
    PatristicDiscoveryRequest,
): Promise<
  PatristicDiscoveryCandidate[]
> {
  console.log(
    "PATRISTIC_WEB_DISCOVERY_DISABLED:",
    {
      query:
        request.query,

      language:
        request.language,
    },
  );

  return [];
}

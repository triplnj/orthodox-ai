import { fetchSourceText }
  from "./fetch-source";

import { extractPatristicQuotes }
  from "./extract-quotes";

import { exactQuoteExists }
  from "./verify";

import { saveVerifiedCandidate }
  from "./save-quotes";

export async function collectFromSource(
  url: string,
) {
  const source =
    await fetchSourceText(url);

  const candidates =
    await extractPatristicQuotes(
      source.text,
      url,
    );

  const results = {
    source: url,

    extracted:
      candidates.length,

    verified: 0,

    rejected: 0,
  };

  for (const candidate of candidates) {

    const exists =
      exactQuoteExists(
        candidate.originalText,
        source.text,
      );

    if (!exists) {

      console.warn(
        "REJECTED QUOTE:",
        candidate.originalText,
      );

      results.rejected++;

      continue;
    }

    await saveVerifiedCandidate(
      candidate,
      url,
    );

    results.verified++;
  }

  return results;
}
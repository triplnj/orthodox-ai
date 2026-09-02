import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import {
  TRUSTED_PATRISTIC_SOURCES,
} from "./trusted-sources";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const DiscoveryCandidateSchema =
  z.object({
    authorName:
      z.string().nullable(),

    workTitle:
      z.string().nullable(),

    originalLanguage:
      z.string().nullable(),

    originalText:
      z.string(),

    sourceUrl:
      z.string(),

    sourceName:
      z.string().nullable(),

    translationSr:
      z.string().nullable(),

    translationEn:
      z.string().nullable(),
  });


const DiscoveryResultSchema =
  z.object({
    candidates:
      z.array(
        DiscoveryCandidateSchema,
      ),
  });


export type PatristicDiscoveryRequest = {
  query: string;
  language: "sr" | "en";
};


export type PatristicDiscoveryCandidate =
  z.infer<
    typeof DiscoveryCandidateSchema
  >;


/*
 * Remove duplicate discovery results.
 *
 * At discovery stage the URL is what matters most,
 * because the real quotation will later be extracted
 * from text fetched by our own server.
 */
function deduplicateCandidates(
  candidates:
    PatristicDiscoveryCandidate[],
) {
  const seen =
    new Set<string>();

  const unique:
    PatristicDiscoveryCandidate[] =
      [];


  for (const candidate of candidates) {
    const url =
      candidate.sourceUrl
        .trim();


    if (!url) {
      continue;
    }


    const normalized =
      url.replace(/\/+$/, "");


    if (
      seen.has(normalized)
    ) {
      continue;
    }


    seen.add(normalized);

    unique.push(candidate);
  }


  return unique;
}


/*
 * Perform one web-discovery pass.
 */
async function runDiscovery(
  query: string,
): Promise<
  PatristicDiscoveryCandidate[]
> {
  const model =
    process.env.PATRISTICS_MODEL;


  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }


  const response =
    await openai.responses.parse({
      model,

      tools: [
        {
          type:
            "web_search_preview",
        },
      ],

      input: query,

      text: {
        format:
          zodTextFormat(
            DiscoveryResultSchema,
            "patristic_discovery",
          ),
      },
    });


  return (
    response
      .output_parsed
      ?.candidates ??
    []
  );
}


export async function discoverPatristicSources(
  request:
    PatristicDiscoveryRequest,
): Promise<
  PatristicDiscoveryCandidate[]
> {

  /*
   * Build the list dynamically from the same
   * trusted-source registry used by verification.
   *
   * This prevents web discovery and source
   * verification from having separate hard-coded
   * domain lists.
   */
  const trustedDomains =
    TRUSTED_PATRISTIC_SOURCES
      .map(
        (source) =>
          source.domain,
      )
      .join("\n");


  /*
   * PASS 1
   *
   * Search trusted textual repositories first.
   *
   * The purpose of this pass is primarily to
   * discover usable URLs.
   *
   * originalText returned here is NOT treated as
   * authoritative by discover-and-save.ts.
   */
  const trustedCandidates =
    await runDiscovery(`
Search for patristic textual sources relevant to
this question:

${request.query}


IMPORTANT SEARCH STRATEGY:

SEARCH THESE TRUSTED DOMAINS FIRST:

${trustedDomains}


Use web search to find relevant pages or documents
ON THOSE DOMAINS.

Do not prefer a general web result over a relevant
result from one of the trusted domains above.


SEARCH IN MULTIPLE LANGUAGES WHERE USEFUL:

- Greek
- English
- Serbian
- Russian
- Romanian


CRITICAL RULES:

1. This is SOURCE DISCOVERY.

2. The most important output is sourceUrl.

3. Prefer pages containing the actual patristic
text rather than commentary about it.

4. Prefer primary-text repositories, editions,
PDFs, scans and established textual libraries.

5. Find the work of the requested Church Father
that actually discusses the user's subject.

6. Never invent a URL.

7. Never invent or reconstruct a quotation.

8. originalText must be wording actually visible
in the discovered source.

9. Never quote from memory.

10. authorName must identify the actual author
when it can be established.

11. workTitle must identify the actual work when
it can be established.

12. sourceUrl must point as directly as possible
to the page, PDF, document or textual edition.

13. originalLanguage describes the language of
originalText as displayed there.

14. Do not claim that the candidate has been
verified.

15. translationSr and translationEn may be null.

16. Prefer several different relevant source URLs
when available.

17. Do not return generic blogs, social-media
pages, quote aggregators or anonymous commentary
when a textual repository is available.

18. A source is useful even if you can identify
the correct document but only a short visible
quotation in search results. Our server will later
fetch and inspect the actual document.

Return structured discovery candidates only.
    `.trim());


  const trustedUnique =
    deduplicateCandidates(
      trustedCandidates,
    );


  console.log(
    "PATRISTIC_TRUSTED_DISCOVERY:",
    {
      query:
        request.query,

      candidates:
        trustedUnique.length,

      urls:
        trustedUnique.map(
          (candidate) =>
            candidate.sourceUrl,
        ),
    },
  );


  /*
   * If trusted search already produced several
   * candidate documents, do not immediately make
   * the result dependent on another broad,
   * stochastic web search.
   */
  if (
    trustedUnique.length >= 3
  ) {
    return trustedUnique;
  }


  /*
   * PASS 2
   *
   * Broad discovery is only a fallback.
   *
   * These additional URLs still have to pass the
   * trusted-source filter later in the pipeline,
   * so discovering an arbitrary blog cannot cause
   * it to enter the database.
   */
  const broadCandidates =
    await runDiscovery(`
Search the public web for patristic textual
material relevant to this question:

${request.query}


SEARCH IN MULTIPLE LANGUAGES WHERE USEFUL:

- Greek
- English
- Serbian
- Russian
- Romanian


TRUSTED DOMAINS THAT HAVE ALREADY BEEN SEARCHED
OR SHOULD STILL BE PREFERRED:

${trustedDomains}


CRITICAL RULES:

1. This is SOURCE DISCOVERY ONLY.

2. The most important output is sourceUrl.

3. Never invent a URL.

4. Never invent or reconstruct a quotation.

5. originalText must be wording actually visible
in the discovered web source.

6. Never quote from memory.

7. Prefer primary patristic texts and reputable
Orthodox, ecclesiastical, monastic, academic or
text-edition sources.

8. Avoid generic blogs, quote aggregators,
anonymous pages and social-media posts.

9. authorName must identify the actual author
when known.

10. workTitle must identify the actual work
when known.

11. sourceUrl must point to the page or document
where the material was discovered.

12. originalLanguage describes the language of
originalText as displayed on that page.

13. Do not claim that any candidate is verified.

14. translationSr and translationEn may be null.

15. Prefer documents that actually contain the
requested author's text rather than pages merely
mentioning the author.

16. Prefer multiple independent textual
repositories where available.

Return structured discovery candidates only.
    `.trim());


  /*
   * Trusted-first results remain first in the
   * returned array.
   */
  const combined =
    deduplicateCandidates([
      ...trustedUnique,
      ...broadCandidates,
    ]);


  console.log(
    "PATRISTIC_COMBINED_DISCOVERY:",
    {
      query:
        request.query,

      trustedFirst:
        trustedUnique.length,

      broad:
        broadCandidates.length,

      total:
        combined.length,

      urls:
        combined.map(
          (candidate) =>
            candidate.sourceUrl,
        ),
    },
  );


  return combined;
}
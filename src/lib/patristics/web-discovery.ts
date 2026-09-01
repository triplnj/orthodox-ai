import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DiscoveryCandidateSchema = z.object({
  authorName: z.string().nullable(),
  workTitle: z.string().nullable(),

  originalLanguage: z.string().nullable(),
  originalText: z.string(),

  sourceUrl: z.string(),
  sourceName: z.string().nullable(),

  translationSr: z.string().nullable(),
  translationEn: z.string().nullable(),
});

const DiscoveryResultSchema = z.object({
  candidates: z.array(
    DiscoveryCandidateSchema,
  ),
});

export type PatristicDiscoveryRequest = {
  query: string;
  language: "sr" | "en";
};

export type PatristicDiscoveryCandidate =
  z.infer<typeof DiscoveryCandidateSchema>;

export async function discoverPatristicSources(
  request: PatristicDiscoveryRequest,
): Promise<PatristicDiscoveryCandidate[]> {
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
          type: "web_search_preview",
        },
      ],

      input: `
Search the public web for Orthodox patristic material
relevant to this question:

${request.query}

SEARCH IN MULTIPLE LANGUAGES WHERE USEFUL:
- English
- Serbian
- Russian
- Greek
- Romanian

CRITICAL RULES:

1. This is DISCOVERY ONLY.

2. Never invent or reconstruct a quotation.

3. originalText must be wording actually visible
in the discovered web source.

4. Never quote from memory.

5. Prefer primary patristic texts and reputable
Orthodox, ecclesiastical, monastic, academic or
text-edition sources.

6. Avoid generic blogs, quote aggregators and
anonymous pages.

7. authorName must identify the actual author
when known.

8. workTitle must identify the actual work
when known.

9. sourceUrl must point to the page where the
wording was discovered.

10. originalLanguage describes the language of
originalText as displayed on that page.

11. Do not claim that any candidate is verified.

12. translationSr and translationEn may be null.
Do not invent translations unless they are needed
to identify the meaning of the candidate.

13. Prefer concise passages directly relevant
to the user's topic.

14. Search broadly enough to find multiple
recognized Orthodox authorities when available.

Return only structured discovery candidates.
      `,

      text: {
        format: zodTextFormat(
          DiscoveryResultSchema,
          "patristic_discovery",
        ),
      },
    });

  return (
    response.output_parsed?.candidates ??
    []
  );
}
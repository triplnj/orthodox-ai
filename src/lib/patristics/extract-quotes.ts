import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  ExtractedQuotesSchema,
  type ExtractedQuote,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractPatristicQuotes(
  sourceText: string,
  sourceUrl: string,
): Promise<ExtractedQuote[]> {
  const model =
    process.env.PATRISTICS_MODEL;

  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }

  const text =
    sourceText.slice(0, 120_000);

  const response =
    await openai.responses.parse({
      model,

      input: [
        {
          role: "system",
          content: `
You extract quotations from primary or scholarly
patristic texts.

CRITICAL RULES:

1. Never invent or reconstruct a quotation.

2. originalText MUST be copied
CHARACTER-FOR-CHARACTER from the supplied source
text.

3. Never modernize Greek spelling.

4. Never silently fix OCR errors.

5. Never combine sentences from different
locations.

6. A paraphrase is NOT a quotation.

7. If the author, work or reference cannot be
established from the supplied material, use null
where allowed.

8. translationSr must be a faithful and relatively
literal Serbian translation of originalText.

9. translationEn must be a faithful and relatively
literal English translation of originalText.

10. Do not use a remembered published translation.
Translate from originalText supplied here.

11. If originalText itself is Serbian,
translationSr may equal originalText.

12. If originalText itself is English,
translationEn may equal originalText.

13. Preserve theological terminology accurately.

14. Extract passages meaningful for Orthodox
theology, asceticism, spiritual life,
anthropology, Christology, ecclesiology,
sacramental theology and related topics.

15. Prefer compact passages of approximately one
sentence or one coherent short paragraph.

16. Do not manufacture PG, SC, CPG, chapter,
homily or paragraph references.

17. Return nothing if you cannot identify an
actual quotation.

Source URL:
${sourceUrl}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],

      text: {
        format: zodTextFormat(
          ExtractedQuotesSchema,
          "patristic_quotes",
        ),
      },
    });

  return (
    response.output_parsed?.quotes ?? []
  );
}

export async function extractRelevantPatristicQuotes(
  sourceText: string,
  sourceUrl: string,
  query: string,
): Promise<ExtractedQuote[]> {
  const model =
    process.env.PATRISTICS_MODEL;

  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }

  const text =
    sourceText.slice(0, 120_000);

  const response =
    await openai.responses.parse({
      model,

      input: [
        {
          role: "system",
          content: `
You extract quotations from a supplied patristic
source text that are directly relevant to the
user's question.

CRITICAL RULES:

1. Never invent or reconstruct a quotation.

2. originalText MUST be copied
CHARACTER-FOR-CHARACTER from the supplied source
text.

3. Never modernize spelling.

4. Never silently correct OCR errors.

5. Never combine text from different locations.

6. A paraphrase is NOT a quotation.

7. Extract only passages that are genuinely
relevant to the user's question.

8. Prefer one complete sentence or one coherent
short paragraph.

9. If no relevant exact quotation exists in the
supplied source text, return no quotations.

10. Establish author, work and references only
from the supplied source text. Do not use memory.

11. Do not manufacture PG, SC, CPG, chapter,
homily or paragraph references.

12. translationSr must be a faithful and
relatively literal Serbian translation of
originalText.

13. translationEn must be a faithful and
relatively literal English translation of
originalText.

14. Do not use remembered published translations.

15. If originalText is Serbian,
translationSr may equal originalText.

16. If originalText is English,
translationEn may equal originalText.

17. Preserve theological terminology accurately.

Source URL:
${sourceUrl}

User question:
${query}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],

      text: {
        format: zodTextFormat(
          ExtractedQuotesSchema,
          "relevant_patristic_quotes",
        ),
      },
    });

  return (
    response.output_parsed?.quotes ?? []
  );
}
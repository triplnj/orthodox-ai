import OpenAI from "openai";

const openai =
  new OpenAI({
    apiKey:
      process.env
        .OPENAI_API_KEY,
  });

export type TextSearchTermsResult = {
  terms: string[];
};

function uniqueTerms(
  values: string[],
) {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value
              .toLowerCase()
              .trim(),
        )
        .filter(
          (value) =>
            value.length >= 3,
        ),
    ),
  ];
}

export async function buildTextSearchTerms(
  query: string,
  targetLanguage: string,
): Promise<
  TextSearchTermsResult
> {
  const response =
    await openai.responses.create({
      model:
        "gpt-4.1-mini",

      input: [
        {
          role:
            "system",

          content: `
Generate conservative search terms for locating
relevant passages inside a patristic source text.

The user question may be in Serbian, English,
German, or another modern language.

Return terms in the TARGET SOURCE LANGUAGE.

Rules:

1. Return only theological/content terms useful
   for lexical retrieval inside the source.

2. Do not include the author's name unless the
   question is bibliographic and authorship itself
   is the subject.

3. Do not include generic stopwords.

4. Include close historical synonyms when useful,
   but avoid broad unrelated vocabulary.

5. Prefer short dictionary forms or stable word
   stems that can match inflected text.

6. Return between 2 and 10 terms.

7. Do not answer the theological question.

TARGET SOURCE LANGUAGE:
${targetLanguage}

Return JSON only:
{
  "terms": ["..."]
}
            `.trim(),
        },

        {
          role:
            "user",

          content:
            query,
        },
      ],

      text: {
        format: {
          type:
            "json_schema",

          name:
            "patristic_text_search_terms",

          strict:
            true,

          schema: {
            type:
              "object",

            additionalProperties:
              false,

            properties: {
              terms: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },
            },

            required: [
              "terms",
            ],
          },
        },
      },
    });

  const raw =
    response.output_text;

  if (!raw) {
    return {
      terms: [],
    };
  }

  try {
    const parsed =
      JSON.parse(
        raw,
      ) as TextSearchTermsResult;

    return {
      terms:
        uniqueTerms(
          parsed.terms ??
            [],
        ),
    };
  } catch {
    return {
      terms: [],
    };
  }
}

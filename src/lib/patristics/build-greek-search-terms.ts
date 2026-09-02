import OpenAI from "openai";


export type GreekSearchTermsResult = {
  concepts: string[];

  greekTerms: string[];

  greekStems: string[];
};


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });


function normalizeGreek(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(
      /[^α-ω\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}


function unique(
  values: string[],
) {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}


export async function buildGreekSearchTerms(
  query: string,
): Promise<
  GreekSearchTermsResult
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
You generate Ancient Greek search terminology
for searching Greek patristic texts.

The user may ask a theological question in any
modern language.

Identify only the central theological concepts
needed to locate relevant passages.

For each concept provide:

1. the concept in the user's language;
2. the most likely Ancient/Patristic Greek
   dictionary term;
3. a conservative Greek search stem.

The stem must be long enough to avoid excessive
false matches but short enough to match common
inflected forms.

Examples:

ψυχή -> ψυχ
θάνατος -> θαν
ἀνάστασις -> αναστα
ἀγάπη -> αγαπ
προσευχή -> προσευχ

Do not answer the theological question.
Do not provide quotations.
Do not invent citations.
Return JSON only.

Format:

{
  "concepts": ["..."],
  "greekTerms": ["..."],
  "greekStems": ["..."]
}

Return between 1 and 6 central concepts.
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
            "greek_search_terms",

          strict:
            true,

          schema: {
            type:
              "object",

            properties: {
              concepts: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },

              greekTerms: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },

              greekStems: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },
            },

            required: [
              "concepts",
              "greekTerms",
              "greekStems",
            ],

            additionalProperties:
              false,
          },
        },
      },
    });


  const raw =
    response.output_text;


  if (!raw) {
    return {
      concepts: [],
      greekTerms: [],
      greekStems: [],
    };
  }


  let parsed:
    GreekSearchTermsResult;


  try {
    parsed =
      JSON.parse(
        raw,
      ) as GreekSearchTermsResult;
  } catch {
    return {
      concepts: [],
      greekTerms: [],
      greekStems: [],
    };
  }


  const concepts =
    unique(
      parsed.concepts ??
        [],
    );


  const greekTerms =
    unique(
      (
        parsed.greekTerms ??
        []
      )
        .map(
          normalizeGreek,
        )
        .filter(Boolean),
    );


  const greekStems =
    unique(
      (
        parsed.greekStems ??
        []
      )
        .map(
          normalizeGreek,
        )
        .filter(
          (stem) =>
            stem.length >= 3,
        ),
    );


  return {
    concepts,

    greekTerms,

    greekStems,
  };
}
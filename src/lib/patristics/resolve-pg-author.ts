import OpenAI from "openai";

import {
  findPatristicAuthor,
  type PatristicAuthorIndex,
} from "./corpus-index";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export type ResolvedPgAuthor = {
  canonicalName: string;

  latinName: string | null;

  greekName: string | null;

  pgVolumes: number[];

  source:
    | "LOCAL_INDEX"
    | "AI_CANDIDATE";

  localAuthor:
    | PatristicAuthorIndex
    | null;
};


type AiAuthorResponse = {
  hasExplicitAuthor: boolean;

  canonicalName:
    | string
    | null;

  latinName:
    | string
    | null;

  greekName:
    | string
    | null;

  pgVolumes: number[];
};


function uniqueValidPgVolumes(
  values: unknown,
): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const volumes =
    values
      .map((value) =>
        typeof value === "number"
          ? value
          : Number(value),
      )
      .filter(
        (value) =>
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 161,
      );

  return [
    ...new Set(volumes),
  ].sort((a, b) => a - b);
}


export async function resolvePgAuthor(
  query: string,
): Promise<
  ResolvedPgAuthor | null
> {
  const trimmedQuery =
    query.trim();

  if (!trimmedQuery) {
    return null;
  }


  /*
   * 1.
   * Deterministički lokalni indeks
   * uvek ima prednost.
   */
  const localAuthor =
    findPatristicAuthor(
      trimmedQuery,
    );


  if (localAuthor) {
    return {
      canonicalName:
        localAuthor.canonicalName,

      latinName:
        null,

      greekName:
        null,

      pgVolumes:
        uniqueValidPgVolumes(
          localAuthor.pgVolumes ??
            [],
        ),

      source:
        "LOCAL_INDEX",

      localAuthor,
    };
  }


  /*
   * 2.
   * Ako autor nije u lokalnom
   * indeksu, AI sme samo da
   * identifikuje eksplicitno
   * pomenutog autora i predloži
   * PG tomove.
   *
   * Ovi tomovi NISU verifikovani
   * samo zato što ih je AI naveo.
   */
  const response =
    await openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      temperature: 0,

      messages: [
        {
          role: "system",

          content: `
You identify explicitly named Church Fathers or ecclesiastical authors
who may appear in Patrologia Graeca.

The user may ask in any language.

Important rules:

1. Identify an author only if the author is explicitly named
   or completely unambiguous in the query.

2. Do not infer an author merely from the theological topic.

3. Return the standard scholarly English canonical name.

4. If known, also return the common Latin and Greek forms of the name.

5. PG volumes are only routing candidates.
   Do not treat them as verified bibliographic facts.

6. Patrologia Graeca contains volumes 1 through 161.

7. If there is no explicit identifiable author, set
   hasExplicitAuthor to false.

Return JSON only.
          `.trim(),
        },

        {
          role: "user",

          content:
            trimmedQuery,
        },
      ],

      response_format: {
        type: "json_schema",

        json_schema: {
          name:
            "pg_author_resolution",

          strict: true,

          schema: {
            type: "object",

            additionalProperties:
              false,

            properties: {
              hasExplicitAuthor: {
                type: "boolean",
              },

              canonicalName: {
                anyOf: [
                  {
                    type: "string",
                  },
                  {
                    type: "null",
                  },
                ],
              },

              latinName: {
                anyOf: [
                  {
                    type: "string",
                  },
                  {
                    type: "null",
                  },
                ],
              },

              greekName: {
                anyOf: [
                  {
                    type: "string",
                  },
                  {
                    type: "null",
                  },
                ],
              },

              pgVolumes: {
                type: "array",

                items: {
                  type: "integer",
                },
              },
            },

            required: [
              "hasExplicitAuthor",
              "canonicalName",
              "latinName",
              "greekName",
              "pgVolumes",
            ],
          },
        },
      },
    });


  const content =
    response.choices[0]
      ?.message
      ?.content;


  if (!content) {
    return null;
  }


  let parsed:
    AiAuthorResponse;

  try {
    parsed =
      JSON.parse(
        content,
      ) as AiAuthorResponse;
  } catch {
    return null;
  }


  if (
    !parsed.hasExplicitAuthor ||
    !parsed.canonicalName
  ) {
    return null;
  }


  const canonicalName =
    parsed.canonicalName.trim();


  if (!canonicalName) {
    return null;
  }


  return {
    canonicalName,

    latinName:
      parsed.latinName
        ?.trim() ||
      null,

    greekName:
      parsed.greekName
        ?.trim() ||
      null,

    pgVolumes:
      uniqueValidPgVolumes(
        parsed.pgVolumes,
      ),

    source:
      "AI_CANDIDATE",

    localAuthor:
      null,
  };
}
import OpenAI from "openai";

import {
  findPatristicAuthor,
  type PatristicAuthorIndex,
} from "./corpus-index";


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


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });


function uniqueVolumes(
  volumes: number[],
) {
  return [
    ...new Set(
      volumes.filter(
        (volume) =>
          Number.isInteger(
            volume,
          ) &&
          volume >= 1 &&
          volume <= 161,
      ),
    ),
  ].sort(
    (a, b) =>
      a - b,
  );
}


export async function resolvePgAuthor(
  query: string,
): Promise<
  ResolvedPgAuthor | null
> {
  /*
   * Lokalni indeks uvek ima
   * prednost.
   */
  const localAuthor =
    findPatristicAuthor(
      query,
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
        uniqueVolumes(
          localAuthor.pgVolumes ??
            [],
        ),

      source:
        "LOCAL_INDEX",

      localAuthor,
    };
  }


  /*
   * Ako autor nije u našem
   * lokalnom indeksu, AI sme
   * samo da predloži identitet
   * autora i moguće PG tomove.
   *
   * Ovo NIJE konačna verifikacija.
   */
  const response =
    await openai.responses.create({
      model:
        "gpt-4.1-mini",

      input: [
        {
          role:
            "system",

          content: `
You identify authors represented in
Jacques-Paul Migne's Patrologia Graeca.

The user may ask in any language.

Determine whether the question explicitly
refers to a specific Christian author whose
works are contained in Patrologia Graeca.

Do not answer the theological question.

Do not infer an author merely from the topic.
The author must be explicitly named or
unambiguously identified in the question.

If there is no specific identifiable PG
author, return found=false.

If there is one, return:
- canonical commonly used English name;
- Latin scholarly name if known;
- Greek name if known;
- candidate Patrologia Graeca volume numbers.

PG has volumes 1 through 161.

The PG volume numbers are routing candidates,
not verified citations.

Return JSON only.
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
            "pg_author_resolution",

          strict:
            true,

          schema: {
            type:
              "object",

            properties: {
              found: {
                type:
                  "boolean",
              },

              canonicalName: {
                type: [
                  "string",
                  "null",
                ],
              },

              latinName: {
                type: [
                  "string",
                  "null",
                ],
              },

              greekName: {
                type: [
                  "string",
                  "null",
                ],
              },

              pgVolumes: {
                type:
                  "array",

                items: {
                  type:
                    "integer",
                },
              },
            },

            required: [
              "found",
              "canonicalName",
              "latinName",
              "greekName",
              "pgVolumes",
            ],

            additionalProperties:
              false,
          },
        },
      },
    });


  if (
    !response.output_text
  ) {
    return null;
  }


  let parsed: {
    found: boolean;

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


  try {
    parsed =
      JSON.parse(
        response.output_text,
      );
  } catch {
    return null;
  }


  if (
    !parsed.found ||
    !parsed.canonicalName
  ) {
    return null;
  }


  const pgVolumes =
    uniqueVolumes(
      parsed.pgVolumes ??
        [],
    );


  /*
   * Bez makar jednog PG toma
   * još nemamo upotrebljiv
   * routing kandidat.
   */
  if (
    pgVolumes.length ===
    0
  ) {
    return null;
  }


  return {
    canonicalName:
      parsed.canonicalName.trim(),

    latinName:
      parsed.latinName?.trim() ||
      null,

    greekName:
      parsed.greekName?.trim() ||
      null,

    pgVolumes,

    source:
      "AI_CANDIDATE",

    localAuthor:
      null,
  };
}
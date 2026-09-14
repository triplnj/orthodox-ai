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



type DeterministicConceptRule = {
  pattern: RegExp;
  concept: string;
  greekTerms: string[];
  greekStems: string[];
};

const DETERMINISTIC_CONCEPT_RULES:
  DeterministicConceptRule[] = [
    {
      pattern: /тројиц|trojic|trinity|dreifalt|triad/i,
      concept: "Trinity",
      greekTerms: ["τριάς"],
      greekStems: ["τριαδ"],
    },
    {
      pattern: /свети дух|sveti duh|holy spirit|heiliger geist/i,
      concept: "Holy Spirit",
      greekTerms: ["πνεῦμα ἅγιον"],
      greekStems: ["πνευμα"],
    },
    {
      pattern: /син бож|sin boz|son of god|gottes sohn|логос|logos/i,
      concept: "Son / Logos",
      greekTerms: ["υἱός", "λόγος"],
      greekStems: ["υιο", "λογ"],
    },
    {
      pattern: /душ|dusa|duša|soul|seele/i,
      concept: "Soul",
      greekTerms: ["ψυχή"],
      greekStems: ["ψυχ"],
    },
    {
      pattern: /васкрс|vaskrs|resurrection|aufersteh/i,
      concept: "Resurrection",
      greekTerms: ["ἀνάστασις"],
      greekStems: ["αναστα"],
    },
    {
      pattern: /смрт|smrt|death|tod/i,
      concept: "Death",
      greekTerms: ["θάνατος"],
      greekStems: ["θανατ"],
    },
    {
      pattern: /молит|molit|prayer|gebet/i,
      concept: "Prayer",
      greekTerms: ["προσευχή"],
      greekStems: ["προσευχ"],
    },
    {
      pattern: /љубав|ljubav|love|liebe/i,
      concept: "Love",
      greekTerms: ["ἀγάπη"],
      greekStems: ["αγαπ"],
    },
    {
      pattern: /суштин|usij|ousia|essence|wesen/i,
      concept: "Essence",
      greekTerms: ["οὐσία"],
      greekStems: ["ουσι"],
    },
    {
      pattern: /ипостас|hypostasis|person|личност|lice|prosopon/i,
      concept: "Hypostasis / Person",
      greekTerms: ["ὑπόστασις", "πρόσωπον"],
      greekStems: ["υποστα", "προσωπ"],
    },
    {
      pattern: /икон|ikona|icon|image|bild/i,
      concept: "Icon / Image",
      greekTerms: ["εἰκών"],
      greekStems: ["εικον"],
    },
    {
      pattern: /обожењ|obozen|theosis|deification|vergott/i,
      concept: "Deification",
      greekTerms: ["θέωσις"],
      greekStems: ["θεωσ"],
    },
  ];

function buildDeterministicGreekTerms(
  query: string,
): GreekSearchTermsResult {
  const concepts: string[] = [];
  const greekTerms: string[] = [];
  const greekStems: string[] = [];

  for (
    const rule of
    DETERMINISTIC_CONCEPT_RULES
  ) {
    if (!rule.pattern.test(query)) {
      continue;
    }

    concepts.push(rule.concept);
    greekTerms.push(...rule.greekTerms);
    greekStems.push(...rule.greekStems);
  }

  return {
    concepts: unique(concepts),
    greekTerms: unique(
      greekTerms
        .map(normalizeGreek)
        .filter(Boolean),
    ),
    greekStems: unique(
      greekStems
        .map(normalizeGreek)
        .filter(
          (stem) =>
            stem.length >= 3,
        ),
    ),
  };
}


export async function buildGreekSearchTerms(
  query: string,
): Promise<
  GreekSearchTermsResult
> {
  const deterministic =
    buildDeterministicGreekTerms(
      query,
    );

  /*
   * Frequent theological concepts are resolved
   * locally. This avoids a paid model call on the
   * common path and makes retrieval reproducible.
   */
  if (
    deterministic.greekStems.length > 0
  ) {
    return deterministic;
  }

  /*
   * Rare or unfamiliar concepts still have a small,
   * bounded AI fallback. It only proposes Greek
   * search vocabulary; it never supplies quotations
   * or source attribution.
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
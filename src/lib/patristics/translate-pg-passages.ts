import OpenAI from "openai";

import type {
  PgPassageMatch,
} from "./pg-passage-search";


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });


export type TranslatedPgPassage =
  PgPassageMatch & {
    translation: string;

    answerLanguage: string;
  };


function detectRequestedLanguage(
  query: string,
) {
  if (
    /[\u0400-\u04FF]/u.test(
      query,
    )
  ) {
    return "Serbian";
  }

  if (
    /[čćžšđ]/iu.test(
      query,
    )
  ) {
    return "Serbian";
  }

  return "the same language as the user's question";
}


async function translateOnePassage(
  query: string,
  passage: PgPassageMatch,
) {
  const answerLanguage =
    detectRequestedLanguage(
      query,
    );


  const response =
    await openai.responses.create({
      model:
        "gpt-4.1-mini",

      input: [
        {
          role: "system",

          content: [
            "You translate ancient Greek patristic texts.",
            "",
            "Translate ONLY the supplied Greek passage.",
            "Do not add theology, interpretation, explanation, or material from memory.",
            "Do not reconstruct missing text.",
            "",
            "The source may contain OCR errors.",
            "Use the surrounding context only to understand damaged words or sentence boundaries.",
            "Do not silently invent words that cannot reasonably be recovered.",
            "",
            `Translate into ${answerLanguage}.`,
            "",
            "Preserve the meaning and structure of the original as closely as natural language permits.",
            "Return only the translation.",
          ].join("\n"),
        },

        {
          role: "user",

          content: [
            "USER QUESTION:",
            query,
            "",
            "GREEK PASSAGE:",
            passage.originalText,
            "",
            "SURROUNDING SOURCE CONTEXT:",
            passage.contextText,
          ].join("\n"),
        },
      ],
    });


  return {
    translation:
      response.output_text.trim(),

    answerLanguage,
  };
}


export async function translatePgPassages(
  query: string,
  passages: PgPassageMatch[],
  limit = 5,
): Promise<
  TranslatedPgPassage[]
> {
  const selected =
    passages.slice(
      0,
      limit,
    );


  const translated =
    await Promise.all(
      selected.map(
        async (
          passage,
        ) => {
          const result =
            await translateOnePassage(
              query,
              passage,
            );


          return {
            ...passage,

            translation:
              result.translation,

            answerLanguage:
              result.answerLanguage,
          };
        },
      ),
    );


  return translated;
}
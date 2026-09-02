import OpenAI from "openai";

import {
  orthodoxSystemPrompt,
} from "./orthodoxSystemPrompt";

import {
  chatContexts,
  type ChatContextKey,
} from "./chatContexts";


const openai =
  new OpenAI({
    apiKey:
      process.env
        .OPENAI_API_KEY,
  });


type GenerateOrthodoxAnswerInput = {
  userMessage: string;

  contextKey?: ChatContextKey;

  extraContext?: string;

  patristicContext?: string | null;

  isPro?: boolean;
};


export async function generateOrthodoxAnswer({
  userMessage,

  contextKey = "general",

  extraContext,

  patristicContext,

  isPro = false,
}: GenerateOrthodoxAnswerInput) {
  const context =
    chatContexts[
      contextKey
    ];


  const planInstruction =
    isPro
      ? "The user has Pro access. You may provide a deeper, more structured answer."
      : "The user is on the Free plan. Keep the answer helpful but concise.";


  const sourceInstruction =
    patristicContext
      ? `
A Patrologia Graeca retrieval has been performed for this question.

You MUST prioritize the supplied PG source material over general
model memory when discussing the named Church Father.

STRICT RULES:

- Answer in the same language as the user's question unless the user
  explicitly requests another language.

- If the user writes in Serbian Cyrillic, answer in Serbian Cyrillic.

- If the user writes in German, answer in German.

- If the user writes in English, answer in English.

- Do not invent quotations.

- Do not attribute a theological statement to a Father merely because
  it is generally Orthodox.

- Distinguish the Father's own teaching from doctrines he is merely
  describing or refuting.

- When a relevant Greek passage is present, translate it directly
  into the user's language.

- Clearly identify direct translation as a translation from the
  supplied Greek PG text.

- Do not pretend that an AI translation is a published translation.

- Do not invent PG columns.

- If only PG volume and digital scan page are known, use those.

- Never say "I have no verified patristic sources" when this source
  context contains relevant PG material.

- Internet Archive/Wikimedia/etc. are digital carriers only.
  The theological source is Patrologia Graeca.

- Do not recommend that the user go to a priest or library merely
  because the text is difficult to locate; the retrieval system has
  already located source material.

- If the retrieved passages are not sufficiently relevant to answer
  the exact question, say that the retrieved PG passages do not yet
  establish the requested point.

PATROLOGIA GRAECA SOURCE MATERIAL:

${patristicContext}
        `.trim()
      : `
No live Patrologia Graeca source material was retrieved for this question.

Do not fabricate patristic quotations or precise citations.
If you give general Orthodox teaching, clearly distinguish it from
a directly sourced statement by a particular Father.
        `.trim();


  const completion =
    await openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      messages: [
        {
          role:
            "system",

          content:
            orthodoxSystemPrompt,
        },

        {
          role:
            "system",

          content:
            sourceInstruction,
        },

        {
          role:
            "user",

          content: `
Current feature context:
${context}

User plan:
${planInstruction}

Additional context:
${extraContext ?? "No additional context provided."}

User message:
${userMessage}
          `.trim(),
        },
      ],

      /*
       * Нижа температура је
       * намерна када радимо
       * изворно осетљиве одговоре.
       */
      temperature:
        patristicContext
          ? 0.15
          : 0.4,
    });


  const answer =
    completion
      .choices[0]
      ?.message
      ?.content ??
    "I could not generate an answer. Please try again.";


  return {
    answer,
  };
}
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
A patristic research retrieval has been performed for this question.

The supplied context may contain evidence from:
- the multi-source verified local patristic database;
- deterministic curated texts;
- live Patrologia Graeca OCR;
- live web research across primary-source and scholarly repositories.

STRICT RULES:

- Answer in the same language as the user's question unless the user explicitly requests another language.
- If the user writes in Serbian Cyrillic, answer in Serbian Cyrillic.
- If the user writes in Serbian Latin, answer in Serbian Latin.
- If the user writes in German, answer in German.
- If the user writes in English, answer in English.
- When the user asks what a particular Church Father teaches, answer about that Father, not about generic Orthodox doctrine.
- Ground specific attribution in the supplied research evidence and prefer primary-source evidence over secondary summaries.
- Evidence from live web research is a discovery layer: use its source provenance carefully and do not upgrade a secondary summary into a direct quotation.
- If independent providers support the same attribution, synthesize them rather than choosing one arbitrarily.
- Never substitute a different Father merely because the retrieved passage is theologically similar.
- Never invent quotations.
- Never invent work titles, PG/PL columns, chapter numbers, homily numbers, or references.
- Distinguish the Father's own teaching from quotations, opponents' doctrines, heresies being described, historical narration, or rhetorical objections.
- If a relevant original-language passage is supplied, translate it directly into the user's language when useful.
- Clearly identify a direct AI translation as a translation from the supplied original text; do not present it as a published translation.
- Treat OCR cautiously when the source context says that it is OCR.
- Use only source URLs present in the supplied research context or structured application metadata. Never invent a URL.
- Do not print raw source URLs or Markdown links in the answer body. Source cards are rendered separately by the application.
- Write clean readable prose. Do not emit escaped Markdown such as \\*\\*, HTML spacing entities such as &#x20;, or malformed link syntax.
- Simple numbered points or short plain-text headings are fine when they improve clarity.
- Do not say that no source is available when the supplied context contains relevant evidence from any provider.
- Do not end historical, textual, or patristic research answers by routinely telling the user to consult a priest, spiritual father, or library.
- Pastoral referral is appropriate only when the user is actually asking for personal spiritual guidance, confession, or pastoral counsel.
- If the supplied evidence is insufficient for the exact requested attribution, say what is established and what remains uncertain.
- Prefer a careful paraphrase over a fabricated exact quotation.

PATRISTIC RESEARCH MATERIAL:

${patristicContext}
        `.trim()
      : `
No patristic research evidence was supplied for this answer.

STRICT RULES:

- Do not fabricate a quotation or precise citation.
- Do not state that a specific Church Father teaches a proposition merely because it matches general Orthodox doctrine.
- If the user explicitly asks what a named Father teaches and no source evidence is available, state that the specific attribution could not be verified from the currently available research providers.
- Do not fill that gap with generic Orthodox teaching as though it were the Father's own teaching.
- Do not pad a failed patristic retrieval with a generic Orthodox essay.
- State the limitation briefly and precisely.
- Do not recommend a priest, spiritual father, or library as a routine fallback for a textual or historical research question.
- You may provide clearly labeled general background only when the user explicitly asks for it.
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

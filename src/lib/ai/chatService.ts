import OpenAI from "openai";
import { orthodoxSystemPrompt } from "./orthodoxSystemPrompt";
import { chatContexts, type ChatContextKey } from "./chatContexts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GenerateOrthodoxAnswerInput = {
  userMessage: string;
  contextKey?: ChatContextKey;
  extraContext?: string;
  isPro?: boolean;
};

export async function generateOrthodoxAnswer({
  userMessage,
  contextKey = "general",
  extraContext,
  isPro = false,
}: GenerateOrthodoxAnswerInput) {
  const context = chatContexts[contextKey];

  const planInstruction = isPro
    ? "The user has Pro access. You may provide a deeper, more structured answer."
    : "The user is on the Free plan. Keep the answer helpful but concise.";

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: orthodoxSystemPrompt,
      },
      {
        role: "user",
        content: `
Current feature context:
${context}

User plan:
${planInstruction}

Additional context:
${extraContext ?? "No additional context provided."}

User message:
${userMessage}
`,
      },
    ],
    temperature: 0.4,
  });

  const answer =
    completion.choices[0]?.message?.content ??
    "I could not generate an answer. Please try again.";

  return {
    answer,
  };
}
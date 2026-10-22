import "server-only";
import { getEncoding } from "js-tiktoken";
import { AiInputError } from "@/lib/ai/requestSecurity";

// All limits are server-owned. Invalid settings fall back; excessive values clamp.
export function conversationLimits() {
  const read = (name: string, fallback: number, max: number, min = 0) => {
    const raw = process.env[name];
    if (!raw || !/^\d+$/.test(raw)) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= min ? Math.min(value, max) : fallback;
  };
  return {
    turns: read("CHAT_HISTORY_MAX_TURNS", 6, 20),
    historyTokens: read("CHAT_HISTORY_MAX_TOKENS", 4000, 12000),
    questionTokens: read("CHAT_QUESTION_MAX_TOKENS", 2000, 4000, 1),
    inputTokens: read("CHAT_INPUT_MAX_TOKENS", 16000, 32000, 4000),
    outputTokens: read("CHAT_OUTPUT_MAX_TOKENS", 2048, 4096, 128),
  };
}
let encoding: ReturnType<typeof getEncoding> | undefined;
export function tokens(text: string) {
  // o200k_base is the encoding used by the existing gpt-4.1-mini answer model.
  encoding ??= getEncoding("o200k_base");
  return encoding.encode(text, [], []).length;
}
export type MemoryMessage = { role: "user" | "assistant"; content: string };
export type MemoryTurn = { question: string; answer: string; evidence?: string | null };
export function checkQuestion(question: string) {
  if (tokens(question) > conversationLimits().questionTokens) {
    throw new AiInputError("Your question is too long. Please shorten it.", 413);
  }
}
export function selectHistory(turns: MemoryTurn[]): MemoryMessage[] {
  const limits = conversationLimits();
  const result: MemoryMessage[] = [];
  if (!limits.turns) return result;
  let used = 0;
  for (const turn of turns.slice(-limits.turns).reverse()) {
    const cost = tokens(turn.question) + tokens(turn.answer) + 24;
    if (used + cost > limits.historyTokens) break;
    result.unshift({ role: "user", content: turn.question }, { role: "assistant", content: turn.answer });
    used += cost;
  }
  return result;
}
export function messageTokens(messages: ReadonlyArray<{ role: string; content: string }>) {
  // Conservative allowance for chat framing, in addition to exact text tokens.
  return 16 + messages.reduce((sum, message) => sum + tokens(message.content) + 12, 0);
}

import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { withAiOperation, quotaSnapshot } from "@/lib/ai/operationLimits";
import { apiFailure, queryInput } from "@/lib/api/validation";
import { aiSecurityResponse, readAiJson, validateAiStrings, AiInputError } from "@/lib/ai/requestSecurity";
import { chatContexts, type ChatContextKey } from "@/lib/ai/chatContexts";
import { getUserProfileContext } from "@/lib/userProfileContext";
import { buildPatristicResearchContext } from "@/lib/patristics/build-patristic-research-context";
import { beginTurn, dispatchTurn, memoryForTurn, completeTurn, failTurn, TurnConflict, type TurnAttempt } from "@/lib/chat/conversations";
import { checkQuestion, selectHistory } from "@/lib/chat/context";
import { snapshotSources } from "@/lib/chat/provenance";
import { visibleMessages } from "@/lib/chat/history";

export async function POST(request: Request) {
  let attempt: TurnAttempt | undefined;
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    queryInput(request);
    const body = await readAiJson(request);
    validateAiStrings(body);
    if (typeof body.message !== "string" || !body.message.trim()) throw new AiInputError("Message is required.");
    if (Object.keys(body).some(key => !["message", "contextKey", "extraContext", "conversationId", "requestId"].includes(key))) throw new AiInputError("Unsupported chat input.");
    const contextKey = (body.contextKey || "general") as ChatContextKey;
    if (!Object.hasOwn(chatContexts, contextKey)) throw new AiInputError("Invalid chat context.");
    for (const key of ["conversationId", "requestId"]) {
      if (body[key] !== undefined && (typeof body[key] !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(body[key]))) throw new AiInputError(`Invalid ${key}.`);
    }
    const message = body.message.trim();
    checkQuestion(message);
    const begun = await beginTurn(user.id, { message, contextKey, extraContext: body.extraContext as string | undefined,
      conversationId: body.conversationId as string | undefined, requestId: body.requestId as string || randomUUID() });
    if (begun.replay) {
      if (!(await visibleMessages(user)).some(message => message.turnId === begun.turn.id && message.role === "assistant")) {
        throw new AiInputError("The saved answer is outside your plan's recent history window.", 403);
      }
      const quota = await quotaSnapshot(user.id, "chat", user);
      return apiJson({ ...(begun.replay as Record<string, unknown>), plan: user.plan, replayed: true, remaining: quota.remaining, quota });
    }
    attempt = begun.turn;
    const turn = attempt;
    return await withAiOperation(user.id, "chat", user, async reservation => {
      await dispatchTurn(turn);
      const turns = await memoryForTurn(turn);
      const history = selectHistory(turns);
      const followUp = /\b(that|those|this|previous|above|it|they|he|she|explain more)\b/i.test(message);
      const priorQuestions = history.filter(item => item.role === "user").map(item => item.content).join("\n");
      const query = followUp && priorQuestions ? `${priorQuestions}\nFollow-up question: ${message}` : message;
      const [profile, research] = await Promise.all([getUserProfileContext(user.id), buildPatristicResearchContext(query)]);
      const result = await generateOrthodoxAnswer({ userMessage: message, contextKey,
        extraContext: `${profile}\n\nPage or feature extra context:\n${body.extraContext ?? "No additional page context provided."}`,
        patristicContext: research?.context ?? null, isPro: isProUser(user), conversation: { turns } });
      const sources = snapshotSources(research?.sources ?? [], true);
      const response = { answer: result.answer, remaining: reservation.remaining, plan: user.plan,
        conversationId: turn.conversationId, turnId: turn.id, requestId: begun.turn.requestId,
        patristicSources: sources, usedPatristicResearch: sources.length > 0,
        usedLivePg: sources.some(source => source.provider === "PATROLOGIA_GRAECA"), patristicProviders: research?.providersSucceeded ?? [] };
      await completeTurn(turn, contextKey, response, sources, research?.context ?? null, result.budget ?? {});
      const quota = await quotaSnapshot(user.id, "chat", user);
      return apiJson({ ...response, quota, remaining: quota.remaining });
    });
  } catch (error) {
    if (attempt) {
      try { await failTurn(attempt); } catch { diagnostic("operation_failed", { operation: "chat", failure: "database" }); }
    }
    const response = aiSecurityResponse(error);
    const recovery = attempt ?? (error instanceof TurnConflict ? error : undefined);
    if (response) return apiJson({ ...await response.json(), ...(recovery ? { conversationId: recovery.conversationId, turnId: recovery instanceof TurnConflict ? recovery.turnId : recovery.id } : {}) }, { status: response.status, headers: response.headers });
    diagnostic("operation_failed", { operation: "chat", failure: failureCategory(error) });
    return apiJson({ ...await apiFailure(error).json(), error: "The answer could not be saved. Reopen this conversation to recover or view its saved answer.",
      ...(attempt ? { conversationId: attempt.conversationId, turnId: attempt.id } : {}) }, { status: 500 });
  }
}

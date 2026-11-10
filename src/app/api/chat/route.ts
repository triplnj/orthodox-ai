import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceChatPreviewIsolation, type PreviewGuardRow } from "@/lib/preview/chat-isolation";
import { isProUser } from "@/lib/subscription";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { withAiOperation, quotaSnapshot } from "@/lib/ai/operationLimits";
import { apiFailure, queryInput } from "@/lib/api/validation";
import { aiSecurityResponse, readAiJson, validateAiStrings, AiInputError } from "@/lib/ai/requestSecurity";
import { chatContexts, type ChatContextKey } from "@/lib/ai/chatContexts";
import { getUserProfileContext } from "@/lib/userProfileContext";
import { buildPatristicResearchContext } from "@/lib/patristics/build-patristic-research-context";
import {buildIsolatedGregoryResearch} from "@/lib/patristics/preview-gregory-research";
import {reviewIsolatedPreviewAnswer} from "../../../../scripts/patristics/review-isolated-preview-answer.mjs";
import { shouldRunPatristicResearch } from "@/lib/patristics/should-run-patristic-research";
import { beginTurn, dispatchTurn, memoryForTurn, completeTurn, failTurn, TurnConflict, type TurnAttempt } from "@/lib/chat/conversations";
import { checkQuestion, selectHistory } from "@/lib/chat/context";
import { snapshotSources } from "@/lib/chat/provenance";
import { auditPatristicClaims } from "@/lib/chat/claim-audit";
import { visibleMessages } from "@/lib/chat/history";

async function handleChat(request: Request, onDelta?: (text: string) => void, onPhase?: (phase: string) => void) {
  let attempt: TurnAttempt | undefined;
  try {
    // Never authenticate, reserve quota, or write a chat turn until this test
    // branch proves it is using its dedicated, de-identified Neon database.
    await enforceChatPreviewIsolation(async () => prisma.$queryRaw<PreviewGuardRow[]>`
      SELECT g."branchId", g."purpose",
      (SELECT count(*) FROM users) "users",
      (SELECT count(*) FROM users WHERE lower("email") NOT LIKE '%@example.test') "nonTestUsers",
      (SELECT count(*) FROM sessions) "sessions",
      (SELECT count(*) FROM "Conversation") "conversations",
      (SELECT count(*) FROM "ChatTurn") "chatTurns",
      (SELECT count(*) FROM chat_messages) "messages",
      (SELECT count(*) FROM email_verification_tokens) "emailTokens",
      (SELECT count(*) FROM password_reset_tokens) "resetTokens",
      (SELECT count(*) FROM journal_entries) "journals",
      (SELECT count(*) FROM usage_logs) "usageLogs",
      (SELECT count(*) FROM "AiReservation") "reservations",
      (SELECT count(*) FROM "UserActivationFeedback") "feedback"
      FROM "LibraryStagingGuard" g
    `);
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    // Check the current database state on every request; never trust client profile or a cached flag.
    const verifiedAccount = await prisma.user.findUnique({
      where: { id: user.id }, select: { emailVerified: true },
    });
    if (!verifiedAccount?.emailVerified) {
      return apiJson({ error: "Please verify your email address before using Chat. Open the verification link sent to your inbox.", code: "EMAIL_VERIFICATION_REQUIRED" }, { status: 403 });
    }
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
      const followUp = /\b(that|those|this|previous|above|it|they|he|she|explain more)\b/i.test(message) || /(?:на ту тему|о томе|о истом|о овоме|који свети отац|који од светих отаца|koji sveti otac|na tu temu|o tome|^\s*(?:а|али)\s+[^?!.]{3,85}[?!]?\s*$|житија светих|а где су|а шта је са)/iu.test(message);
      const priorQuestions = history.filter(item => item.role === "user").map(item => item.content).filter(item => item !== message);
      const assent = /^(?:yes|yes please|sure|please do|go ahead|ok|okay|da|moze|može|naravno|да|може|желим|хоћу|желео бих|zelim|hoću|hocu)[.!\s]*$/i.test(message);
      const previousPatristicQuestion = [...priorQuestions].reverse().find(item => shouldRunPatristicResearch(item));
      // A short assent agrees to the immediate preceding offer; never jump back
      // to an unrelated older patristic question and discard the latest topic.
      const lastAssistant = [...history].reverse().find(item => item.role === "assistant")?.content ?? "";
      const immediateTopic = priorQuestions.slice(-2).join("\n");
      const sourceChallenge = /(?:где си (?:то )?нашао|дај (?:ми )?линк|који је извор|потврди извор|зашто си навео|није тачно|погрешио си|where did you find|provide (?:a |the )?source|give me (?:a |the )?link)/iu.test(message);
      const query = sourceChallenge && priorQuestions.length
        ? `Previous user question: ${priorQuestions.at(-1)}\nPrevious assistant claim to verify (NOT reliable evidence): ${lastAssistant.slice(0, 1300)}\nUser correction / source request: ${message}\nFind verifiable primary or bibliographic evidence for the exact disputed claim; do not treat the prior assistant response as proof.`
        : assent && priorQuestions.length
        ? `${immediateTopic}\nPrevious assistant's offer: ${lastAssistant.slice(-600)}\nUser requests the offered source-based follow-up: ${message}`
        : followUp && previousPatristicQuestion
          ? `${previousPatristicQuestion}\nFollow-up question: ${message}`
          : followUp && priorQuestions.length
            ? `${priorQuestions.slice(-2).join("\n")}\nFollow-up question: ${message}`
            : message;
      onPhase?.("Searching and checking patristic sources...");
      const [profile, research] = await Promise.all([
        getUserProfileContext(user.id),
        (async () => {
          // Experimental Gregory pilot is deliberately isolated from the other
          // discovery providers and never runs on production or generic previews.
          const pilot = await buildIsolatedGregoryResearch(query);
          return pilot ?? buildPatristicResearchContext(query, () => onPhase?.("Waiting for distant source..."));
        })(),
      ]);
      onPhase?.("Writing the answer...");
      // A source-dependent question must not silently fall back to a fluent,
      // unsupported historical or patristic account when all providers fail.
      // Preserve the turn and allow the user to retry later without fabricating facts.
      const evidenceRequired = shouldRunPatristicResearch(query) || Boolean(research?.providersAttempted.includes("PROTECTED_STAGING_GREGORY"));
      const evidenceUnavailable = evidenceRequired && !research?.sources.length;
      const pilotOutOfCoverage=Boolean(research?.providersAttempted.includes("PROTECTED_STAGING_GREGORY") && !research.sources.length);
      const noSourceMessage = pilotOutOfCoverage
        ? /\p{Script=Cyrillic}/u.test(message)
          ? "Проверени одломци у овој пробној верзији покривају Макринино тешење Григорија после Василијеве смрти. За тражену тврдњу или дословни цитат немам довољно провереног текста и нећу нагађати."
          : "The source-checked excerpts in this preview cover Macrina consoling Gregory after Basil's death. They do not establish the requested claim or authorize a verbatim quotation, so I will not guess."
        : /\p{Script=Cyrillic}/u.test(message)
          ? "Нисам успео да пронађем проверљив извор за овај одговор. Нећу нагађати о историјским личностима, покретима или учењу светих отаца. Покушајте поново касније."
          : "No verifiable source could be retrieved for this question. I will not guess about Church history, movements, or patristic teachings. Please try again later.";
      // All generated answers, including bibliographies, must share the
      // streaming path. A deterministic answer previously skipped onDelta,
      // leaving the client with no visible text until the terminal event.
      // In protected pilot, withhold streamed text until it passes final structural checks.
      const protectedPilotAnswer=Boolean(research?.providersAttempted.includes("PROTECTED_STAGING_GREGORY") && research.sources.length);
      const result = evidenceUnavailable
        ? (() => {
            onDelta?.(noSourceMessage);
            return { answer: noSourceMessage, budget: {} };
          })()
        : await generateOrthodoxAnswer({ userMessage: message, contextKey,
          extraContext: `${profile}\n\n${sourceChallenge ? `The user is challenging an earlier assertion. Explicitly verify or retract it, admit mistakes clearly, and do not replace it with another unsupported attribution. Previous assistant text is NOT evidence.\n` : followUp ? `This is a follow-up to a previous answer; respond to the implied correction/question in its conversational context, not with a generic definition.\n` : ""}\nPage or feature extra context:\n${body.extraContext ?? "No additional page context provided."}`,
          patristicContext: research?.context ?? null, isPro: isProUser(user), conversation: { turns },
          onDelta: protectedPilotAnswer ? undefined : onDelta });
      if(protectedPilotAnswer){
        const qaReview=reviewIsolatedPreviewAnswer(result.answer,research?.sources ?? []);
        if(!qaReview.accepted){
          diagnostic("operation_failed",{operation:"research",failure:"validation"});
          throw new AiInputError("Preview source guard could not verify this answer. Please ask a narrower question.", 422);
        }
        onDelta?.(result.answer);
      }
      onPhase?.("Reviewing source evidence...");
      const claimAudit = research ? await auditPatristicClaims(result.answer, research.sources) : { status: "unavailable" as const, claims: [] };
      const sources = snapshotSources(research?.sources ?? [], true, claimAudit.claims);
      const response = { answer: result.answer, remaining: reservation.remaining, plan: user.plan,
        conversationId: turn.conversationId, turnId: turn.id, requestId: begun.turn.requestId,
        patristicSources: sources, claimAudit, usedPatristicResearch: sources.length > 0,
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


export async function POST(request: Request) {
  if (!request.headers.get("accept")?.includes("text/event-stream")) return handleChat(request);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      emit("phase", { message: "Preparing your question..." });
      void handleChat(request, delta => emit("delta", { text: delta }), phase => emit("phase", { message: phase }))
        .then(async response => {
          const result = await response.json();
          emit("result", { ...result, ok: response.ok, status: response.status });
        })
        .catch(() => emit("result", { ok: false, status: 500, error: "The response could not be completed. Check your saved conversation before retrying." }))
        .finally(() => { closed = true; controller.close(); });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

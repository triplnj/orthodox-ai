import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { withAiOperation, quotaSnapshot } from "@/lib/ai/operationLimits";
import { apiFailure, queryInput } from "@/lib/api/validation";
import { aiSecurityResponse, readAiJson, validateAiStrings, AiInputError } from "@/lib/ai/requestSecurity";
import { chatContexts, type ChatContextKey } from "@/lib/ai/chatContexts";
import { getUserProfileContext } from "@/lib/userProfileContext";
import { buildPatristicResearchContext } from "@/lib/patristics/build-patristic-research-context";
import { shouldRunPatristicResearch } from "@/lib/patristics/should-run-patristic-research";
import { reviewedGregoryAnswerIssues } from "@/lib/patristics/reviewed-gregory-answer";
import { beginTurn, dispatchTurn, memoryForTurn, completeTurn, failTurn, TurnConflict, type TurnAttempt } from "@/lib/chat/conversations";
import { checkQuestion, selectHistory } from "@/lib/chat/context";
import { snapshotSources } from "@/lib/chat/provenance";
import { auditPatristicClaims } from "@/lib/chat/claim-audit";
import { gatePatristicAnswer } from "@/lib/chat/evidence-gate";
import { isUniversalBibliographyQuestion } from "@/lib/patristics/universal-bibliography-resolver";
import { visibleMessages } from "@/lib/chat/history";

async function handleChat(request: Request, onDelta?: (text: string) => void, onPhase?: (phase: string) => void) {
  let attempt: TurnAttempt | undefined;
  try {
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
      const [profile, research] = await Promise.all([getUserProfileContext(user.id), buildPatristicResearchContext(query, () => onPhase?.("Waiting for distant source..."), message)]);
      onPhase?.("Writing the answer...");
      // A source-dependent question must not silently fall back to a fluent,
      // unsupported historical or patristic account when all providers fail.
      // Preserve the turn and allow the user to retry later without fabricating facts.
      const reviewedPilot = !!research?.sources.length && research.sources.every(source => source.metadata?.reviewedPilot === true);
      const evidenceRequired = shouldRunPatristicResearch(query);
      const evidenceUnavailable = evidenceRequired && !research?.sources.length;
      // Bibliographies carry work-role evidence rather than doctrinal passages;
      // preserve the separate bibliography resolver and its existing UI.
      const doctrinalSourceGate = evidenceRequired && !isUniversalBibliographyQuestion(message) &&
        !research?.sources.some(source => source.metadata?.bibliographyCatalog === true);
      const noSourceMessage = /\p{Script=Cyrillic}/u.test(message)
        ? "Нисам успео да пронађем проверљив извор за овај одговор. Нећу нагађати о историјским личностима, покретима или учењу светих отаца. Покушајте поново касније."
        : "No verifiable source could be retrieved for this question. I will not guess about Church history, movements, or patristic teachings. Please try again later.";
      // All generated answers, including bibliographies, must share the
      // streaming path. A deterministic answer previously skipped onDelta,
      // leaving the client with no visible text until the terminal event.
      let result = evidenceUnavailable
        ? (() => {
            onDelta?.(noSourceMessage);
            return { answer: noSourceMessage, budget: {} };
          })()
        : await generateOrthodoxAnswer({ userMessage: message, contextKey,
          extraContext: `${profile}\n\n${sourceChallenge ? `The user is challenging an earlier assertion. Explicitly verify or retract it, admit mistakes clearly, and do not replace it with another unsupported attribution. Previous assistant text is NOT evidence.\n` : followUp ? `This is a follow-up to a previous answer; respond to the implied correction/question in its conversational context, not with a generic definition.\n` : ""}\nPage or feature extra context:\n${body.extraContext ?? "No additional page context provided."}`,
          patristicContext: research?.context ?? null, isPro: isProUser(user), conversation: { turns },
          // Never stream an unreviewed pilot answer before the source safety gate.
          onDelta: reviewedPilot || doctrinalSourceGate ? undefined : onDelta });
      if (reviewedPilot && research) {
        let issues = reviewedGregoryAnswerIssues(result.answer, research.sources, message);
        if (issues.length) {
          diagnostic("operation_failed", { operation: "research", failure: "validation" });
          // Only the source issue codes are sent to the model; no discarded answer
          // is leaked or saved. The second answer passes the very same validator.
          const regenerated = await generateOrthodoxAnswer({
            userMessage: message, contextKey, isPro: isProUser(user),
            conversation: { turns }, patristicContext: research.context,
            extraContext: [
              "The first draft did not pass the reviewed primary-text safeguards.",
              "Write one clear paragraph in the original user's language and script.",
              "Base every historical or theological claim only on the three supplied",
              "opening excerpts describing Macrina consoling Gregory after Basil's death.",
              "Natural grief is permitted; distinguish mourning from hopeless despair.",
              "No horses, cavalry, outside works, direct quotations or PG references.",
              "Review issue codes: " + issues.join(", ")
            ].join("\n"),
            onDelta: undefined,
          });
          issues = reviewedGregoryAnswerIssues(regenerated.answer, research.sources, message);
          if (issues.length) {
            diagnostic("operation_failed", { operation: "research", failure: "validation" });
            throw new AiInputError(
              "The reviewed source could not support a safe answer to this question. Please rephrase your question.",
              422
            );
          }
          result = regenerated;
        }
        // Stream only the answer that passed the pilot's source guard.
        if (!doctrinalSourceGate) onDelta?.(result.answer);
      }
      onPhase?.("Reviewing source evidence...");
      const claimAudit = research ? await auditPatristicClaims(result.answer, research.sources) : { status: "unavailable" as const, claims: [] };
      if (doctrinalSourceGate && !evidenceUnavailable) {
        const screened = gatePatristicAnswer(result.answer, claimAudit, /\p{Script=Cyrillic}/u.test(message) || /\b(sveti|svetog|svetom|vaspit|deca)\b/i.test(message) ? "sr" : "en");
        if (screened !== result.answer) {
          diagnostic("operation_completed", { operation: "research", count: claimAudit.claims.filter(item => item.status === "excerpt_matched").length });
        }
        result = { ...result, answer: screened };
        onDelta?.(screened);
      }
      // A source card without a surviving claim mapping is not evidence for
      // the final answer. Do not flood the answer with discovery-only links.
      const snapshots = snapshotSources(research?.sources ?? [], true,
        doctrinalSourceGate ? claimAudit.claims.filter(item => result.answer.includes(item.claim)) : claimAudit.claims);
      const sources = doctrinalSourceGate ? snapshots.filter(source => source.claimMappings.length > 0) : snapshots;
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

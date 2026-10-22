import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AiInputError } from "@/lib/ai/requestSecurity";
import { conversationLimits, type MemoryTurn } from "./context";
import type { AnswerSource } from "./provenance";

type Tx = Prisma.TransactionClient;
export class TurnConflict extends AiInputError {
  constructor(message: string, readonly conversationId: string, readonly turnId: string) { super(message, 409); }
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function lock(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`chat:${userId}`}, 0))`;
}
export async function beginTurn(userId: string, input: {
  message: string; contextKey: string; extraContext?: string; conversationId?: string; requestId: string;
}) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ message: input.message,
    contextKey: input.contextKey, extraContext: input.extraContext ?? "", conversationId: input.conversationId ?? null })).digest("hex");
  return prisma.$transaction(async tx => {
    await lock(tx, userId);
    if (input.conversationId && !await tx.conversation.findFirst({ where: { id: input.conversationId, userId } })) {
      throw new AiInputError("Conversation not found.", 404);
    }
    const previous = await tx.chatTurn.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new AiInputError("Request ID was already used for different input.", 409);
      if (previous.status === "COMPLETED" && previous.responseSnapshot) return { replay: previous.responseSnapshot, turn: previous };
      throw new TurnConflict("This request already exists. Reopen the conversation and recover an interrupted turn before trying again.", previous.conversationId, previous.id);
    }
    const conversation = input.conversationId
      ? await tx.conversation.findFirstOrThrow({ where: { id: input.conversationId, userId } })
      : await tx.conversation.create({ data: { userId, contextKey: input.contextKey } });
    if (conversation.contextKey !== input.contextKey) throw new AiInputError("Conversation feature does not match.", 400);
    if (conversation.activeTurnId) throw new TurnConflict("A turn is in progress. Reopen this conversation to recover it.", conversation.id, conversation.activeTurnId);
    const turn = await tx.chatTurn.create({ data: { userId, conversationId: conversation.id,
      requestId: input.requestId, fingerprint, question: input.message, executionToken: randomUUID() } });
    await tx.conversation.update({ where: { id: conversation.id }, data: { activeTurnId: turn.id } });
    return { turn, replay: null };
  });
}
export type TurnAttempt = { id: string; userId: string; conversationId: string; executionToken: string; question: string };
async function assertAttempt(tx: Tx, attempt: TurnAttempt) {
  const turn = await tx.chatTurn.findFirst({ where: { id: attempt.id, userId: attempt.userId,
    executionToken: attempt.executionToken, status: { in: ["PENDING", "RUNNING"] } } });
  const conversation = await tx.conversation.findFirst({ where: { id: attempt.conversationId, userId: attempt.userId,
    activeTurnId: attempt.id } });
  if (!turn || !conversation) throw new AiInputError("This execution was fenced by recovery. Its answer was not saved.", 409);
}
export async function dispatchTurn(attempt: TurnAttempt) {
  await prisma.$transaction(async tx => {
    await lock(tx, attempt.userId); await assertAttempt(tx, attempt);
    await tx.chatTurn.update({ where: { id: attempt.id }, data: { status: "RUNNING", dispatchedAt: new Date() } });
  });
}
export async function memoryForTurn(attempt: TurnAttempt): Promise<MemoryTurn[]> {
  const rows = await prisma.chatTurn.findMany({ where: { userId: attempt.userId,
    conversationId: attempt.conversationId, status: "COMPLETED", id: { not: attempt.id } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: conversationLimits().turns,
    select: { question: true, messages: { where: { role: "assistant" }, take: 1, select: { content: true } } } });
  return rows.reverse().flatMap(row => row.messages[0] ? [{ question: row.question, answer: row.messages[0].content }] : []);
}
export async function completeTurn(attempt: TurnAttempt, contextKey: string, response: Record<string, unknown>,
  sources: AnswerSource[], evidence: string | null, budget: unknown) {
  await prisma.$transaction(async tx => {
    await lock(tx, attempt.userId); await assertAttempt(tx, attempt);
    const common = { userId: attempt.userId, conversationId: attempt.conversationId, turnId: attempt.id, category: contextKey };
    await tx.chatMessage.create({ data: { ...common, role: "user", content: attempt.question } });
    await tx.chatMessage.create({ data: { ...common, role: "assistant", content: String(response.answer),
      sources: { create: sources.map((source, sourceOrder) => ({ sourceOrder, provider: source.provider,
        authorName: source.authorName, workTitle: source.workTitle, reference: source.reference,
        originalLanguage: source.originalLanguage, sourceUrl: source.sourceUrl, scanUrl: source.scanUrl,
        verificationStatus: source.verificationStatus, includedInContext: source.includedInContext, snapshot: json(source) })) } } });
    await tx.chatTurn.update({ where: { id: attempt.id }, data: { status: "COMPLETED", finishedAt: new Date(),
      evidenceSnapshot: json({ context: evidence }), responseSnapshot: json(response), budgetSnapshot: json(budget) } });
    await tx.conversation.update({ where: { id: attempt.conversationId }, data: { activeTurnId: null } });
  });
}
export async function failTurn(attempt: TurnAttempt) {
  // Do not overwrite a completed or recovered execution, even on a late error.
  await prisma.$transaction(async tx => {
    await lock(tx, attempt.userId);
    const changed = await tx.chatTurn.updateMany({ where: { id: attempt.id, userId: attempt.userId,
      executionToken: attempt.executionToken, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", failureCode: "EXECUTION_FAILED", finishedAt: new Date() } });
    if (changed.count) await tx.conversation.updateMany({ where: { id: attempt.conversationId,
      userId: attempt.userId, activeTurnId: attempt.id }, data: { activeTurnId: null } });
  });
}
export async function recoverTurn(userId: string, conversationId: string, turnId: string) {
  return prisma.$transaction(async tx => {
    await lock(tx, userId);
    const conversation = await tx.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!conversation) throw new AiInputError("Conversation not found.", 404);
    const turn = await tx.chatTurn.findFirst({ where: { id: turnId, userId, conversationId } });
    if (!turn) throw new AiInputError("Turn not found.", 404);
    if (turn.status === "COMPLETED") throw new AiInputError("This turn completed. Reload its saved answer.", 409);
    if (turn.status !== "ABANDONED") await tx.chatTurn.update({ where: { id: turnId }, data: {
      status: "ABANDONED", executionToken: randomUUID(), finishedAt: new Date(), failureCode: "OWNER_RECOVERY" } });
    await tx.conversation.updateMany({ where: { id: conversationId, userId, activeTurnId: turnId }, data: { activeTurnId: null } });
    // AI reservations are deliberately not changed: recovery never refunds/bypasses quotas.
    return { question: turn.question, recoveredTurnId: turnId };
  });
}

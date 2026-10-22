import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AppUser } from "@/lib/subscription";
import { ApiError } from "@/lib/api/validation";
import { quotaSnapshot, reserveAiOperation, type AiFeature } from "./operationLimits";

export const AI_CACHE_RETENTION_MS = 7 * 86400000;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function lock(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`ai:${userId}`}, 0))`;
}
export async function cleanupPrivateResponses(userId?: string) {
  // Charged tombstones are retained permanently until account deletion.
  return prisma.aiReservation.updateMany({ where: { ...(userId ? { userId } : {}), requestKey: { not: null }, status: "COMPLETED",
    finishedAt: { lte: new Date(Date.now() - AI_CACHE_RETENTION_MS) } },
    data: { status: "RESULT_EXPIRED", responseSnapshot: Prisma.DbNull } });
}
async function existingResponse(row: { status: string; responseSnapshot: Prisma.JsonValue | null; finishedAt?: Date | null }, user: AppUser, feature: AiFeature) {
  if (row.finishedAt && row.finishedAt.getTime() <= Date.now() - AI_CACHE_RETENTION_MS) throw new ApiError("This cached result has expired. A new request uses normal quota.", 410, "RESULT_EXPIRED");
  if (row.status === "RESULT_EXPIRED") throw new ApiError("This cached result has expired. A new request uses normal quota.", 410, "RESULT_EXPIRED");
  if (row.status !== "COMPLETED" || !row.responseSnapshot) throw new ApiError("This request has no completed result. Check its status before explicitly starting a new request.", 409,
    row.status === "RUNNING" ? "AI_OPERATION_IN_PROGRESS" : "REQUEST_TERMINAL");
  const quota = await quotaSnapshot(user.id, feature, user);
  return NextResponse.json({ ...(row.responseSnapshot as Record<string, unknown>), replayed: true, quota, remaining: quota.remaining });
}
export async function personalRequestStatus(user: AppUser, feature: AiFeature, requestId: string) {
  await cleanupPrivateResponses(user.id);
  const row = await prisma.aiReservation.findFirst({ where: { userId: user.id, subject: user.id, feature, requestKey: requestId } });
  if (!row) throw new ApiError("Request not found.", 404, "NOT_FOUND");
  if (row.status === "COMPLETED") return existingResponse(row, user, feature);
  return NextResponse.json({ status: row.status, uncertain: row.status === "RUNNING", requestId,
    quota: await quotaSnapshot(user.id, feature, user), code: row.status === "RESULT_EXPIRED" ? "RESULT_EXPIRED" : "REQUEST_STATUS" });
}
export async function recoverPersonalRequest(user: AppUser, feature: AiFeature, requestId: string) {
  return prisma.$transaction(async tx => {
    await lock(tx, user.id);
    const row = await tx.aiReservation.findFirst({ where: { userId: user.id, subject: user.id, feature, requestKey: requestId } });
    if (!row) throw new ApiError("Request not found.", 404, "NOT_FOUND");
    if (row.status === "COMPLETED" || row.status === "RESULT_EXPIRED") throw new ApiError("This request already finished. Check its saved status.", 409, "REQUEST_TERMINAL");
    if (row.status === "RUNNING") await tx.aiReservation.updateMany({ where: { id: row.id, userId: user.id, status: "RUNNING" }, data: { status: "ABANDONED", finishedAt: new Date() } });
    // Keep the renewable capacity lease separate from this completion fence.
    return { recovered: true, message: "The previous result is fenced. A new request uses normal quota. The previous provider call may still be running." };
  });
}
export async function runPersonalRequest(user: AppUser, feature: AiFeature, body: Record<string, unknown>,
  work: () => Promise<Response>, summaryInput?: { id: string; content: string; title: string | null }) {
  const requestKey = body.requestId as string;
  const canonical = Object.fromEntries(Object.entries(body).filter(([key]) => key !== "requestId").sort(([a], [b]) => a.localeCompare(b)));
  const requestHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  await cleanupPrivateResponses(user.id);
  const reservation = await reserveAiOperation(user.id, feature, user, { requestKey, requestHash });
  if (reservation.previous) {
    if (reservation.previous.userId !== user.id || reservation.previous.requestHash !== requestHash) throw new ApiError("Request ID was already used for different input.", 409, "IDEMPOTENCY_CONFLICT");
    return existingResponse(reservation.previous, user, feature);
  }
  let renewing: Promise<unknown> | undefined;
  const heartbeat = setInterval(() => {
    if (!renewing) renewing = prisma.aiReservation.updateMany({ where: { id: reservation.id, status: { in: ["RUNNING", "ABANDONED"] } },
      data: { expiresAt: new Date(Date.now() + 300000) } }).catch(() => {}).finally(() => { renewing = undefined; });
  }, 30000);
  heartbeat.unref();
  try {
    // Check the fence immediately before dispatch. No transaction spans provider work.
    const active = await prisma.aiReservation.findFirst({ where: { id: reservation.id, userId: user.id, status: "RUNNING" } });
    if (!active) throw new ApiError("This request was recovered or deleted.", 409, "REQUEST_FENCED");
    const response = await work();
    const payload = await response.json();
    if (!response.ok) {
      await prisma.aiReservation.updateMany({ where: { id: reservation.id, status: "RUNNING" }, data: { status: "FAILED", finishedAt: new Date() } });
      return responseWithQuota(payload, response.status, user, feature);
    }
    // Persist only the established feature response, never credentials/errors.
    const snapshot = feature === "journal-summary" ? { summary: payload.summary, entry: payload.entry } : { plan: payload.plan };
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 240000) throw new ApiError("The generated result is too large to save safely.", 502, "AI_RESULT_TOO_LARGE");
    await prisma.$transaction(async tx => {
      await lock(tx, user.id);
      const changed = await tx.aiReservation.updateMany({ where: { id: reservation.id, userId: user.id, status: "RUNNING" },
        data: { status: "COMPLETED", finishedAt: new Date(), responseSnapshot: json(snapshot) } });
      if (!changed.count) throw new ApiError("This result was fenced or its account was deleted.", 409, "REQUEST_FENCED");
      if (summaryInput) {
        const saved = await tx.journalEntry.updateMany({ where: { id: summaryInput.id, userId: user.id, content: summaryInput.content, title: summaryInput.title }, data: { aiSummary: payload.summary, updatedAt: new Date(payload.entry.updatedAt) } });
        if (!saved.count) throw new ApiError("The journal entry changed. This older summary was not saved.", 409, "RESOURCE_CHANGED");
      }
    });
    return responseWithQuota(snapshot, 200, user, feature);
  } catch (error) {
    // Network/commit ambiguity never automatically retries the provider. A
    // database transaction failure may leave RUNNING; status/recovery reconciles it.
    if (error instanceof ApiError) throw error;
    throw new ApiError("The operation outcome is uncertain. Check its status or recover it before starting a new request.", 503, "AI_OUTCOME_UNCERTAIN");
  } finally {
    clearInterval(heartbeat); await renewing;
    // Release capacity only once this worker's provider work has settled. A
    // recovered worker cannot alter result/status, but can retire its own lease.
    await prisma.aiReservation.updateMany({ where: { id: reservation.id, status: "ABANDONED" }, data: { expiresAt: new Date() } });
  }
}
async function responseWithQuota(payload: Record<string, unknown>, status: number, user: AppUser, feature: AiFeature) {
  const quota = await quotaSnapshot(user.id, feature, user);
  return NextResponse.json({ ...payload, quota, remaining: quota.remaining }, { status });
}

import "server-only";
import { NextResponse } from "next/server";
import { AiLimitError } from "./operationLimits";
import { ApiError, apiFailure, readJson } from "@/lib/api/validation";

export class AiInputError extends ApiError {
  constructor(message: string, status = 400) { super(message, status, ({ 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "IDEMPOTENCY_CONFLICT", 413: "PAYLOAD_TOO_LARGE", 502: "AI_SERVICE_FAILED" } as Record<number, string>)[status] ?? "INVALID_INPUT"); }
}

export async function readAiJson(request: Request): Promise<Record<string, unknown>> {
  return readJson(request);
}

export function validateAiStrings(body: Record<string, unknown>) {
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null && (typeof value !== "string" || value.length > 20_000)) {
      throw new AiInputError(`Invalid or oversized ${key}.`);
    }
  }
}

export function aiSecurityResponse(error: unknown) {
  if (error instanceof AiLimitError) {
    return NextResponse.json({ error: error.message, limitType: error.limitType,
      code: error.limitType === "daily" ? "DAILY_QUOTA_EXHAUSTED" : error.limitType === "concurrency" ? "AI_OPERATION_IN_PROGRESS" : error.limitType === "rate" ? "RATE_LIMITED" : "FORBIDDEN",
      upgradeRequired: error.upgradeRequired, quota: error.quota, remaining: error.quota?.remaining, retryAfterSeconds: error.retryAfterSeconds }, { status: error.status,
      headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined });
  }
  if (error instanceof ApiError) return apiFailure(error);
  return null;
}

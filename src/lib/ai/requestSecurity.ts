import "server-only";
import { NextResponse } from "next/server";
import { AiLimitError } from "./operationLimits";

export class AiInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function readAiJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new AiInputError("JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 65_536) {
        await reader.cancel();
        throw new AiInputError("Request is too large.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AiInputError("Invalid JSON body."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiInputError("JSON object is required.");
  return value as Record<string, unknown>;
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
      upgradeRequired: error.upgradeRequired }, { status: error.status,
      headers: error.status === 429 ? { "Retry-After": "60" } : undefined });
  }
  if (error instanceof AiInputError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}

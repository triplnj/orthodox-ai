import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "INVALID_INPUT", readonly fields?: Record<string, string>) { super(message); }
}
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid identifier.");
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(`Please check ${result.error.issues[0]?.path.join(".") || "the submitted fields"}.`, 400, "INVALID_INPUT",
    Object.fromEntries(result.error.issues.map(issue => [issue.path.join(".") || "request", issue.code === "unrecognized_keys" ? "Unexpected fields." : issue.message])));
  return result.data;
}
export async function readJson(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!type || !(type === "application/json" || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(type))) throw new ApiError("Send this request as JSON.", 415, "UNSUPPORTED_MEDIA_TYPE");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("JSON body is required.");
  let bytes = 0; let timedOut = false;
  const chunks: Uint8Array[] = [];
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > maxBytes) { await reader.cancel(); throw new ApiError("Request is too large.", 413, "PAYLOAD_TOO_LARGE"); }
      chunks.push(chunk.value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  if (timedOut) throw new ApiError("Request body timed out.", 408, "REQUEST_TIMEOUT");
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new ApiError("Invalid JSON body.", 400, "INVALID_JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("A JSON object is required.");
  return body as Record<string, unknown>;
}
export function queryInput(request: Request, allowed: string[] = []) {
  const params = new URL(request.url).searchParams;
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!allowed.includes(key) || Object.hasOwn(values, key)) throw new ApiError("Invalid or repeated query parameter.");
    values[key] = value;
  }
  return values;
}
export function apiFailure(error: unknown) {
  const known = error instanceof ApiError;
  return NextResponse.json({ error: known ? error.message : "The request could not be completed. Please try again later.",
    code: known ? error.code : "INTERNAL_ERROR", ...(known && error.fields ? { fieldErrors: error.fields } : {}) },
  { status: known ? error.status : 500 });
}
export const journalSchema = z.strictObject({ title: z.string().trim().max(200).optional(), content: z.string().trim().min(1).max(40000) });
export const profileSchema = z.strictObject({ name: z.string().trim().max(80) });
export const onboardingSchema = z.strictObject({
  spiritualGoal: z.enum(["build prayer habit", "understand fasting", "read Scripture", "use spiritual journal", "learn Orthodox basics"]),
  experienceLevel: z.enum(["beginner", "returning", "regular but inconsistent", "experienced"]),
  dailyTime: z.enum(["5 minutes", "10 minutes", "15 minutes", "20 minutes", "30 minutes"]),
});
const time = z.enum(["5 minutes per day", "10 minutes per day", "15 minutes per day", "20 minutes per day", "30 minutes per day"]).optional();
export const personalFeatures = ["prayer-plan", "fasting-plan", "scripture-plan", "journal-summary"] as const;
export const personalFeatureSchema = z.enum(personalFeatures);
export const operationIdentitySchema = z.strictObject({ feature: personalFeatureSchema, requestId: idSchema });
const key = { requestId: idSchema.optional() };
export const planSchemas = {
  "prayer-plan": z.strictObject({ ...key, experienceLevel: z.enum(["beginner", "returning to prayer", "regular but inconsistent", "already has a prayer rule"]).optional(), availableTime: time, focus: z.string().trim().max(2000).optional() }),
  "fasting-plan": z.strictObject({ ...key, experienceLevel: z.enum(["beginner", "returning to fasting", "fasts sometimes", "regular but inconsistent", "already follows a parish fasting rhythm"]).optional(),
    fastingContext: z.enum(["ordinary week", "Wednesday and Friday fasting", "Great Lent", "Nativity Fast", "Apostles’ Fast", "Dormition Fast", "preparing for confession and communion"]).optional(),
    availableDiscipline: z.enum(["small and realistic changes", "moderate discipline", "mostly food simplicity", "focus on prayer and self-control", "needs a very gentle approach"]).optional(), currentChallenge: z.string().trim().max(2000).optional() }),
  "scripture-plan": z.strictObject({ ...key, experienceLevel: z.enum(["beginner", "returning to Scripture", "reads occasionally", "already reads daily"]).optional(), availableTime: time, goal: z.string().trim().max(2000).optional() }),
  "journal-summary": z.strictObject({ ...key, entryId: idSchema }),
};

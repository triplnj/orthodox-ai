import { apiJson } from "@/lib/api/response";
import "server-only";
import { ApiError, readJson } from "@/lib/api/validation";

export class AuthError extends Error {
  constructor(message: string, readonly status = 400, readonly retryAfter?: number) { super(message); }
}
export async function authJson(req: Request): Promise<Record<string, unknown>> {
  return readJson(req, 16384);

}
export function text(body: Record<string, unknown>, key: string, max = 256): string {
  const value = body[key];
  if (typeof value !== "string" || value.length > max) throw new AuthError(`Invalid ${key}.`);
  return value;
}
export function emailAddress(body: Record<string, unknown>) {
  const email = text(body, "email", 254).trim().toLowerCase();
  if (!/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) throw new AuthError("Valid email is required.");
  return email;
}
export function newPassword(value: string) {
  if (value.length < 8 || Buffer.byteLength(value, "utf8") > 72) throw new AuthError("Password must contain at least 8 characters and at most 72 UTF-8 bytes.");
  return value;
}
export function tokenValue(body: Record<string, unknown>) {
  const token = text(body, "token", 64).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AuthError("Invalid or expired token.");
  return token;
}
export function authFailure(error: unknown) {
  return apiJson({ error: error instanceof AuthError || error instanceof ApiError ? error.message : "Authentication is temporarily unavailable. Please try again later.",
    code: error instanceof ApiError ? error.code : error instanceof AuthError ? ({ 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 429: "RATE_LIMITED" } as Record<number, string>)[error.status] ?? "INVALID_INPUT" : "AUTH_SERVICE_UNAVAILABLE" }, {
    status: error instanceof AuthError || error instanceof ApiError ? error.status : 503,
    headers: error instanceof AuthError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined,
  });
}

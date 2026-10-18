import "server-only";
import { NextResponse } from "next/server";

export class AuthError extends Error {
  constructor(message: string, readonly status = 400, readonly retryAfter?: number) { super(message); }
}
export async function authJson(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new AuthError("JSON body is required.");
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 16384) { await reader.cancel(); throw new AuthError("Request is too large.", 413); }
      chunks.push(chunk.value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  if (timedOut) throw new AuthError("Request body timed out.", 408);
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AuthError("Invalid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthError("JSON object is required.");
  return body as Record<string, unknown>;
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
  return NextResponse.json({ error: error instanceof AuthError ? error.message : "Authentication is temporarily unavailable. Please try again later." }, {
    status: error instanceof AuthError ? error.status : 503,
    headers: error instanceof AuthError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined,
  });
}

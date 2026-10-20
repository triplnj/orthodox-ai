import { NextResponse } from "next/server";
export function apiJson<T>(body: T, init?: ResponseInit) {
  const code = ({ 400: "INVALID_INPUT", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 408: "REQUEST_TIMEOUT", 409: "CONFLICT", 410: "RESULT_EXPIRED", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE", 429: "RATE_LIMITED", 500: "INTERNAL_ERROR", 502: "UPSTREAM_FAILURE", 503: "SERVICE_UNAVAILABLE", 504: "UPSTREAM_TIMEOUT" } as Record<number, string>)[init?.status ?? 200];
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    const safe: Record<string, unknown> = { ...body, code: "code" in body ? body.code : code ?? "REQUEST_FAILED" };
    if ((init?.status ?? 200) >= 500 && !("code" in body)) safe.error = "The service could not complete this request. Please try again later.";
    for (const key of ["details", "stack", "cause", "debug"]) delete safe[key];
    return NextResponse.json(safe, init);
  }
  return NextResponse.json(body, init);
}

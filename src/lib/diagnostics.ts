import "server-only";

const events = ["operation_started", "operation_completed", "operation_skipped", "operation_failed", "billing_provider_unavailable", "billing_ownership_conflict", "review_transition"] as const;
const operations = ["account", "auth", "chat", "dashboard", "history", "journal", "plans", "profile", "export", "review", "research", "retrieval", "discovery", "extraction", "verification", "translation", "embedding", "workflow", "billing", "heartbeat"] as const;
const outcomes = ["started", "succeeded", "skipped", "failed", "unavailable", "conflict"] as const;
const failures = ["timeout", "rate_limit", "authentication", "permission", "provider", "database", "unexpected"] as const;
export type DiagnosticEvent = typeof events[number];
export type DiagnosticOperation = typeof operations[number];
export type FailureCategory = typeof failures[number];
export function failureCategory(error: unknown): FailureCategory {
  // Never serialize error/message/cause/headers, or invoke arbitrary getters.
  try {
    if (!error || typeof error !== "object") return "unexpected";
    const status = Object.getOwnPropertyDescriptor(error, "status")?.value;
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (status === 408 || status === 504 || code === "ETIMEDOUT") return "timeout";
    if (status === 429) return "rate_limit";
    if (status === 401) return "authentication";
    if (status === 403) return "permission";
    if (typeof code === "string" && /^P\d{4}$/.test(code)) return "database";
    if (typeof status === "number" && status >= 500 && status <= 599) return "provider";
  } catch { /* Unknown/proxy exceptions remain content-free. */ }
  return "unexpected";
}
export function diagnostic(event: DiagnosticEvent, input: unknown = {}) {
  if (!(events as readonly unknown[]).includes(event)) return;
  // Web Crypto is available in the Node server runtime without importing a
  // Node-only module into durable workflow bundles. Diagnostics run in steps.
  let record: Record<string, unknown>;
  try { record = { event, correlationId: globalThis.crypto.randomUUID(), at: new Date().toISOString() }; }
  catch { return; } // Diagnostic initialization must never change operation outcomes.
  try {
    if (input && typeof input === "object") {
      const values = Object.getOwnPropertyDescriptors(input);
      for (const [key, allowed] of [["operation", operations], ["outcome", outcomes], ["failure", failures]] as const) {
        const value = values[key]?.value;
        if ((allowed as readonly unknown[]).includes(value)) record[key] = value;
      }
      for (const key of ["count", "durationMs", "sessionsRevoked", "resetTokensInvalidated", "verificationTokensInvalidated"] as const) {
        const value = values[key]?.value;
        if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000) record[key] = value;
      }
      const status = values.status?.value;
      if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) record.status = status;
      const correlation = values.correlationId?.value;
      if (typeof correlation === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(correlation)) record.correlationId = correlation;
    }
  } catch { /* Never fall back to serializing an unknown payload. */ }
  try { console.info(JSON.stringify(record)); } catch { /* Logging cannot change operation outcomes. */ }
}
const jobFailures = ["RESEARCH_TIMEOUT", "RESEARCH_RATE_LIMIT", "RESEARCH_AUTHENTICATION", "RESEARCH_PERMISSION", "RESEARCH_PROVIDER", "RESEARCH_DATABASE", "RESEARCH_UNEXPECTED"] as const;
export function safeResearchFailure(error: unknown): string {
  return `RESEARCH_${failureCategory(error).toUpperCase()}`;
}
export function persistedResearchFailure(value: unknown): string {
  return (jobFailures as readonly unknown[]).includes(value) ? value as string : "RESEARCH_UNEXPECTED";
}
/** Fail closed before SDK/adapter construction; DEBUG is otherwise handled by dependencies. */
export function assertSafeDiagnosticEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DEBUG?.trim() || process.env.NODE_DEBUG?.trim()) {
    throw new Error("Verbose dependency diagnostics are disabled in production.");
  }
}

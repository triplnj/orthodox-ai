import "server-only";
import OpenAI from "openai";
import { assertSafeDiagnosticEnvironment } from "@/lib/diagnostics";

export class OpenAIConfigurationError extends Error {
  readonly code = "OPENAI_NOT_CONFIGURED";

  constructor() {
    super("OpenAI credentials are not configured for this server operation.");
    this.name = "OpenAIConfigurationError";
  }
}

let client: OpenAI | undefined;

/** Importing this module never reads credentials or constructs an SDK client. */
export function getOpenAI(): OpenAI {
  assertSafeDiagnosticEnvironment();
  if (client) return client;

  // Preserve the SDK's existing API-key/admin-key environment authentication.
  // Read at first use so build analysis does not need runtime credentials.
  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_ADMIN_KEY) {
    throw new OpenAIConfigurationError();
  }

  // Leave base URL, organization, project, retries, and timeouts to the same
  // SDK defaults/environment configuration used by the previous clients.
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, logLevel: "off" });
  return client;
}

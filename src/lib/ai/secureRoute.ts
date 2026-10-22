import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { withAiOperation, type AiFeature } from "./operationLimits";
import { aiSecurityResponse, readAiJson, validateAiStrings, AiInputError } from "./requestSecurity";
import { chatContexts } from "./chatContexts";
import { planSchemas, parse, queryInput } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { runPersonalRequest } from "./personalRequests";
import type { z } from "zod";

export function secureAiRoute(
  handler: (request: Request, reservation: { id: string; remaining: number }) => Promise<Response>,
  feature: AiFeature,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = feature === "review" ? undefined : await getCurrentUser() ?? undefined;
      if (feature !== "review" && !user) return apiJson({ error: "You must be signed in." }, { status: 401 });
      queryInput(request);
      let body = await readAiJson(request);
      validateAiStrings(body);
      if (feature === "review" && Object.keys(body).some(key => !["token", "message", "contextKey"].includes(key))) throw new AiInputError("Unexpected review fields.");
      let summaryInput: { id: string; content: string; title: string | null } | undefined;
      if (feature in planSchemas) {
        body = parse(planSchemas[feature as keyof typeof planSchemas] as z.ZodType<Record<string, unknown>>, body);
        if (feature === "journal-summary" && user) {
          const entry = await prisma.journalEntry.findFirst({ where: { id: body.entryId as string, userId: user.id } });
          if (!entry) throw new AiInputError("Journal entry not found.", 404);
          if (entry.content.length > 40000) throw new AiInputError("Journal entry is too long to summarize.", 413);
          summaryInput = { id: entry.id, content: entry.content, title: entry.title };
        }
      }
      if (feature === "review" && (!process.env.REVIEW_ACCESS_TOKEN || body.token !== process.env.REVIEW_ACCESS_TOKEN)) {
        return apiJson({ error: "Review access is invalid or expired." }, { status: 401 });
      }
      if ((feature === "chat" || feature === "review") && (typeof body.message !== "string" || !body.message.trim())) {
        throw new AiInputError("Message is required.");
      }
      if (body.contextKey && !(typeof body.contextKey === "string" && Object.hasOwn(chatContexts, body.contextKey))) {
        throw new AiInputError("Invalid chat context.");
      }
      if (feature === "journal-summary" && (typeof body.entryId !== "string" || !body.entryId.trim())) {
        throw new AiInputError("Journal entry ID is required.");
      }
      const headers = new Headers(request.headers);
      headers.set("content-type", "application/json");
      headers.set("x-ai-defer-summary", body.requestId && feature === "journal-summary" ? "1" : "0");
      const invoke = (reservation: { id: string; remaining: number }) => handler(new Request(request.url, { method: "POST", headers, body: JSON.stringify(body) }), reservation);
      if (user && body.requestId && feature in planSchemas) return await runPersonalRequest(user, feature, body, () => invoke({ id: "keyed", remaining: 0 }), summaryInput);
      return await withAiOperation(user?.id ?? "review:fr-josiah", feature, user, invoke);
    } catch (error) {
      const response = aiSecurityResponse(error);
      if (response) return response;
      diagnostic("operation_failed", { operation: "chat", failure: failureCategory(error) });
      return apiJson({ error: "The AI operation could not be completed. Please try again." }, { status: 500 });
    }
  };
}

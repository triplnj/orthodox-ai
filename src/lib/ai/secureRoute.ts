import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withAiOperation, type AiFeature } from "./operationLimits";
import { aiSecurityResponse, readAiJson, validateAiStrings, AiInputError } from "./requestSecurity";
import { chatContexts } from "./chatContexts";

export function secureAiRoute(
  handler: (request: Request, reservation: { id: string; remaining: number }) => Promise<Response>,
  feature: AiFeature,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = feature === "review" ? undefined : await getCurrentUser() ?? undefined;
      if (feature !== "review" && !user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
      const body = await readAiJson(request);
      validateAiStrings(body);
      if (feature === "review" && (!process.env.REVIEW_ACCESS_TOKEN || body.token !== process.env.REVIEW_ACCESS_TOKEN)) {
        return NextResponse.json({ error: "Review access is invalid or expired." }, { status: 401 });
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
      return await withAiOperation(user?.id ?? "review:fr-josiah", feature, user, (reservation) =>
        handler(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }), reservation));
    } catch (error) {
      const response = aiSecurityResponse(error);
      if (response) return response;
      console.error("AI_OPERATION_FAILED:", error);
      return NextResponse.json({ error: "The AI operation could not be completed. Please try again." }, { status: 500 });
    }
  };
}

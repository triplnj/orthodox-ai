import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { aiSecurityResponse } from "@/lib/ai/requestSecurity";
import { secureAiRoute } from "@/lib/ai/secureRoute";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import type { ChatContextKey } from "@/lib/ai/chatContexts";

function isValidReviewToken(token: string | null) {
  const expectedToken = process.env.REVIEW_ACCESS_TOKEN;

  if (!expectedToken) {
    return false;
  }

  return token === expectedToken;
}

async function handleAiRequest(req: Request) {
  try {
    const body = await req.json();

    const token = body.token as string | undefined;
    const message = body.message as string | undefined;
    const contextKey = body.contextKey as ChatContextKey | undefined;

    if (!isValidReviewToken(token ?? null)) {
      return apiJson(
        { error: "Review access is invalid or expired." },
        { status: 401 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return apiJson(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const result = await generateOrthodoxAnswer({
      userMessage: message.trim(),
      contextKey: contextKey ?? "general",
      extraContext: `
Private review mode for Fr. Josiah Trenham.

The reviewer is evaluating OrthodoxAI for theological, pastoral, and practical safety.

Answer as OrthodoxAI normally would, but be especially careful to demonstrate:
- clear Orthodox Christian boundaries;
- no replacement of priest, confession, Church authority, therapy, medicine, or emergency help;
- educational tone;
- pastoral caution;
- humility when uncertain.
`,
      isPro: true,
    });

    return apiJson({
      answer: result.answer,
    });
  } catch (error) {
    const securityError = aiSecurityResponse(error);
    if (securityError) return securityError;
    diagnostic("operation_failed", { operation: "review", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while generating the review answer." },
      { status: 500 }
    );
  }
}
export const POST = secureAiRoute(handleAiRequest, "review");

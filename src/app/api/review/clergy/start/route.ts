import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { queryInput } from "@/lib/api/validation";
import { withAiOperation } from "@/lib/ai/operationLimits";
import { aiSecurityResponse } from "@/lib/ai/requestSecurity";
import { NextRequest, NextResponse } from "next/server";
import { startReviewSession, validReviewAccessToken } from "@/lib/security/review-provisioning";
import { ReviewIdentityError } from "@/lib/security/review-identities";

export async function GET(req: NextRequest) {
  try {
    const token = queryInput(req, ["token"]).token ?? null;

    if (!validReviewAccessToken("clergy", token)) {
      return apiJson(
        { error: "Review access is invalid or expired." },
        { status: 401 }
      );
    }

    return await withAiOperation("review:clergy-start", "review", undefined, async () => {
      await startReviewSession("clergy");

      return NextResponse.redirect(new URL("/dashboard", req.url));
    });
  } catch (error) {
    if (error instanceof ReviewIdentityError) return apiJson({ error: error.message, code: error.code }, { status: error.status });
    const response = aiSecurityResponse(error);
    if (response) return response;
    diagnostic("operation_failed", { operation: "review", failure: failureCategory(error) });

    return apiJson(
      { error: "Could not start clergy review access." },
      { status: 500 }
    );
  }
}

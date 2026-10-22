import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { quotaSnapshot, type AiFeature } from "@/lib/ai/operationLimits";
import { ApiError, apiFailure, queryInput } from "@/lib/api/validation";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(); if (!user) throw new ApiError("You must be signed in.", 401, "UNAUTHENTICATED");
    const feature = queryInput(request, ["feature"]).feature ?? "chat";
    if (!["chat", "prayer-plan", "fasting-plan", "scripture-plan", "journal-summary"].includes(feature)) throw new ApiError("Invalid feature.");
    return apiJson({ quota: await quotaSnapshot(user.id, feature as AiFeature, user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

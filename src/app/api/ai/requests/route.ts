import { getCurrentUser } from "@/lib/auth";
import { ApiError, apiFailure, parse, queryInput, operationIdentitySchema } from "@/lib/api/validation";
import { personalRequestStatus } from "@/lib/ai/personalRequests";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(); if (!user) throw new ApiError("You must be signed in.", 401, "UNAUTHENTICATED");
    const input = parse(operationIdentitySchema, queryInput(request, ["feature", "requestId"]));
    const response = await personalRequestStatus(user, input.feature, input.requestId); response.headers.set("Cache-Control", "no-store"); return response;
  } catch (error) { return apiFailure(error); }
}

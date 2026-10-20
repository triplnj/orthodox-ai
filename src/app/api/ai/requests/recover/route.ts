import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, apiFailure, parse, readJson, operationIdentitySchema } from "@/lib/api/validation";
import { recoverPersonalRequest } from "@/lib/ai/personalRequests";
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(); if (!user) throw new ApiError("You must be signed in.", 401, "UNAUTHENTICATED");
    const input = parse(operationIdentitySchema, await readJson(request, 16384));
    return apiJson(await recoverPersonalRequest(user, input.feature, input.requestId));
  } catch (error) { return apiFailure(error); }
}

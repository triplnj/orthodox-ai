import { apiJson } from "@/lib/api/response";
import { timingSafeEqual, createHash } from "node:crypto";
import { cleanupPrivateResponses } from "@/lib/ai/personalRequests";
import { ApiError, apiFailure, queryInput } from "@/lib/api/validation";
export async function POST(request: Request) {
  try {
    const expected = process.env.AI_CACHE_CLEANUP_SECRET;
    const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!expected || !supplied || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(supplied).digest())) throw new ApiError("Unauthorized.", 401, "UNAUTHENTICATED");
    queryInput(request);
    return apiJson({ cleared: (await cleanupPrivateResponses()).count });
  } catch (error) { return apiFailure(error); }
}

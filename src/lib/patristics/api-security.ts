import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { withAiOperation } from "@/lib/ai/operationLimits";
import { readAiJson, validateAiStrings, aiSecurityResponse, AiInputError } from "@/lib/ai/requestSecurity";

export async function researchPrincipal(request: Request, developmentOnly = false): Promise<string | Response> {
  if (developmentOnly && process.env.NODE_ENV === "production" && process.env.ENABLE_PATRISTICS_TEST_ROUTES !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const configured = process.env.PATRISTICS_SECRET;
  const supplied = request.headers.get("x-patristics-secret");
  if (configured && supplied && timingSafeEqual(
    createHash("sha256").update(configured).digest(), createHash("sha256").update(supplied).digest(),
  )) return "research:worker";
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const ids = (process.env.PATRISTICS_ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!user.emailVerified || !ids.includes(user.id)) {
    return NextResponse.json({ error: "Research administrator access is required." }, { status: 403 });
  }
  return user.id;
}

export function secureResearchRoute(handler: (request: NextRequest) => Promise<Response>, developmentOnly = false) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const subject = await researchPrincipal(request, developmentOnly);
      if (typeof subject !== "string") return subject;
      const body = request.body ? await readAiJson(request) : {};
      validateAiStrings(body);
      if (typeof body.query === "string" && body.query.length > 2_000) throw new AiInputError("Query is too long.");
      return await withAiOperation(subject, "research", undefined, () => handler(new NextRequest(request.url, {
        method: "POST", headers: request.headers, body: JSON.stringify(body),
      })));
    } catch (error) {
      return aiSecurityResponse(error) ?? NextResponse.json({ error: "Research operation failed." }, { status: 500 });
    }
  };
}

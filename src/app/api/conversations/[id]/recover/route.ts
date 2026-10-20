import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { recoverTurn } from "@/lib/chat/conversations";
import { readAiJson, aiSecurityResponse, AiInputError } from "@/lib/ai/requestSecurity";
import { parse, idSchema, queryInput } from "@/lib/api/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    const body = await readAiJson(request);
    queryInput(request);
    if (Object.keys(body).some(key => key !== "turnId")) throw new AiInputError("Unexpected recovery fields.");
    if (typeof body.turnId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.turnId)) throw new AiInputError("Invalid turn ID.");
    const recovered = await recoverTurn(user.id, parse(idSchema, (await params).id), body.turnId);
    return apiJson({ ...recovered, notice: "The previous attempt is fenced. Sending again uses normal quota. An earlier AI operation may still need to finish before another request is allowed." });
  } catch (error) { return aiSecurityResponse(error) ?? apiJson({ error: "Recovery failed. Reload before trying again." }, { status: 500 }); }
}

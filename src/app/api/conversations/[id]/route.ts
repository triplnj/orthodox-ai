import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { readConversation } from "@/lib/chat/history";
import { aiSecurityResponse } from "@/lib/ai/requestSecurity";
import { parse, idSchema, queryInput } from "@/lib/api/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    queryInput(_request);
    return apiJson(await readConversation(user, parse(idSchema, (await params).id)));
  } catch (error) { return aiSecurityResponse(error) ?? apiJson({ error: "Could not load conversation." }, { status: 500 }); }
}

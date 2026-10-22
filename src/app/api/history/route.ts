import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { ApiError } from "@/lib/api/validation";
import { apiFailure } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { visibleMessages } from "@/lib/chat/history";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to view conversation history." },
        { status: 401 }
      );
    }

    const isPro = isProUser(user);

    const messages = await visibleMessages(user);

    return apiJson({
      messages,
      plan: user.plan,
      isPro,
      limit: isPro ? 100 : 10,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "history", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while loading conversation history." },
      { status: 500 }
    );
  }
}

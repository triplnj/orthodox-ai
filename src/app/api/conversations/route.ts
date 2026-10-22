import { apiFailure } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visibleMessages } from "@/lib/chat/history";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    const visible = await visibleMessages(user);
    const ids = [...new Set(visible.flatMap(message => message.conversationId ? [message.conversationId] : []))];
    const conversations = await prisma.conversation.findMany({ where: { userId: user.id, id: { in: ids } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    // Include pending/failed first turns even though no completed message exists yet.
    const interrupted = await prisma.chatTurn.findMany({ where: { userId: user.id, status: { in: ["PENDING", "RUNNING", "FAILED"] } },
      orderBy: { createdAt: "desc" }, take: 10, select: { conversationId: true } });
    return apiJson({ conversations, interruptedConversationIds: [...new Set(interrupted.map(turn => turn.conversationId))] });
  } catch (error) { return apiFailure(error); }
}

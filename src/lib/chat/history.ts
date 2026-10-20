import "server-only";
import { prisma } from "@/lib/prisma";
import { isProUser, type AppUser } from "@/lib/subscription";
import { AiInputError } from "@/lib/ai/requestSecurity";

export async function visibleMessages(user: AppUser) {
  // Apply the existing GLOBAL Free/Pro history window before selecting a thread.
  return prisma.chatMessage.findMany({ where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: isProUser(user) ? 100 : 10,
    include: { sources: { orderBy: { sourceOrder: "asc" } } } });
}
export async function readConversation(user: AppUser, id: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id, userId: user.id } });
  if (!conversation) throw new AiInputError("Conversation not found.", 404);
  const messages = (await visibleMessages(user)).filter(message => message.conversationId === id).sort((a, b) => {
    if (a.turnId === b.turnId && a.role !== b.role) return a.role === "user" ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  });
  const latest = await prisma.chatTurn.findFirst({ where: { conversationId: id, userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, status: true, question: true } });
  return { conversationId: id, contextKey: conversation.contextKey, messages,
    interruptedTurn: latest && latest.status !== "COMPLETED" && latest.status !== "ABANDONED" ? latest : null };
}

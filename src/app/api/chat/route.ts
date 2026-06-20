import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { canUseChat, logUsage } from "@/lib/usage";
import { isProUser } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/auth";
import type { ChatContextKey } from "@/lib/ai/chatContexts";
import { getUserProfileContext } from "@/lib/userProfileContext";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use OrthodoxAI." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const message = body.message as string | undefined;
    const contextKey = body.contextKey as ChatContextKey | undefined;
    const extraContext = body.extraContext as string | undefined;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const permission = await canUseChat(user);

    if (!permission.allowed) {
      return NextResponse.json(
        {
          error: permission.reason,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: "user",
        content: message.trim(),
        category: contextKey ?? "general",
      },
    });

    const userProfileContext = await getUserProfileContext(user.id);

const combinedExtraContext = `
${userProfileContext}

Page or feature extra context:
${extraContext ?? "No additional page context provided."}
`;

const result = await generateOrthodoxAnswer({
  userMessage: message.trim(),
  contextKey: contextKey ?? "general",
  extraContext: combinedExtraContext,
  isPro: isProUser(user),
});

    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: "assistant",
        content: result.answer,
        category: contextKey ?? "general",
      },
    });

    await logUsage(user.id, "chat");

    return NextResponse.json({
      answer: result.answer,
      remaining: permission.remaining,
      plan: user.plan,
    });
  } catch (error) {
    console.error("CHAT_API_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while generating the answer." },
      { status: 500 }
    );
  }
}
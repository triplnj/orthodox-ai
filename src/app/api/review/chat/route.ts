import { NextResponse } from "next/server";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import type { ChatContextKey } from "@/lib/ai/chatContexts";

function isValidReviewToken(token: string | null) {
  const expectedToken = process.env.REVIEW_ACCESS_TOKEN;

  if (!expectedToken) {
    return false;
  }

  return token === expectedToken;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const token = body.token as string | undefined;
    const message = body.message as string | undefined;
    const contextKey = body.contextKey as ChatContextKey | undefined;

    if (!isValidReviewToken(token ?? null)) {
      return NextResponse.json(
        { error: "Review access is invalid or expired." },
        { status: 401 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const result = await generateOrthodoxAnswer({
      userMessage: message.trim(),
      contextKey: contextKey ?? "general",
      extraContext: `
Private review mode for Fr. Josiah Trenham.

The reviewer is evaluating OrthodoxAI for theological, pastoral, and practical safety.

Answer as OrthodoxAI normally would, but be especially careful to demonstrate:
- clear Orthodox Christian boundaries;
- no replacement of priest, confession, Church authority, therapy, medicine, or emergency help;
- educational tone;
- pastoral caution;
- humility when uncertain.
`,
      isPro: true,
    });

    return NextResponse.json({
      answer: result.answer,
    });
  } catch (error) {
    console.error("REVIEW_CHAT_API_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while generating the review answer." },
      { status: 500 }
    );
  }
}
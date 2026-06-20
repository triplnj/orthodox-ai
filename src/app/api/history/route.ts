import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to view conversation history." },
        { status: 401 }
      );
    }

    const isPro = isProUser(user);

    const messages = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: isPro ? 100 : 10,
    });

    return NextResponse.json({
      messages,
      plan: user.plan,
      isPro,
      limit: isPro ? 100 : 10,
    });
  } catch (error) {
    console.error("HISTORY_GET_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading conversation history." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use the journal." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return NextResponse.json(
        {
          error: "The Spiritual Journal is available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      entries,
    });
  } catch (error) {
    console.error("JOURNAL_GET_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading journal entries." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use the journal." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return NextResponse.json(
        {
          error: "The Spiritual Journal is available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const title = body.title as string | undefined;
    const content = body.content as string | undefined;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Journal content is required." },
        { status: 400 }
      );
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        title: title?.trim() || "Untitled reflection",
        content: content.trim(),
      },
    });

    return NextResponse.json({
      entry,
    });
  } catch (error) {
    console.error("JOURNAL_POST_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while saving the journal entry." },
      { status: 500 }
    );
  }
}
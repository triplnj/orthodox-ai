import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to export your data." },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionId: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const [messages, usageLogs, journalEntries] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.usageLog.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.journalEntry.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      app: "OrthodoxAI",
      user: dbUser,
      messages,
      usageLogs,
      journalEntries,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="orthodoxai-export-${user.id}.json"`,
      },
    });
  } catch (error) {
    console.error("SETTINGS_EXPORT_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while exporting your data." },
      { status: 500 }
    );
  }
}
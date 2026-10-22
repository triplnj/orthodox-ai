import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { ApiError } from "@/lib/api/validation";
import { apiFailure } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
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
      return apiJson(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const [messages, usageLogs, journalEntries, conversations] = await Promise.all([
      prisma.chatMessage.findMany({
        include: { sources: { orderBy: { sourceOrder: "asc" } } },
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
      prisma.conversation.findMany({ where: { userId: user.id }, include: {
        turns: { select: { id: true, requestId: true, question: true, status: true, createdAt: true,
          dispatchedAt: true, finishedAt: true, failureCode: true, evidenceSnapshot: true, budgetSnapshot: true } },
      } }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      app: "OrthodoxAI",
      user: dbUser,
      messages,
      usageLogs,
      journalEntries,
      conversations,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="orthodoxai-export-${user.id}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "export", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while exporting your data." },
      { status: 500 }
    );
  }
}

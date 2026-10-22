import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { ApiError } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { apiFailure, parse, readJson, journalSchema } from "@/lib/api/validation";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to use the journal." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return apiJson(
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

    return apiJson({
      entries,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "journal", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while loading journal entries." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to use the journal." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return apiJson(
        {
          error: "The Spiritual Journal is available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = parse(journalSchema, await readJson(req, 262144));

    const title = body.title as string | undefined;
    const content = body.content as string | undefined;

    if (!content || typeof content !== "string" || !content.trim()) {
      return apiJson(
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

    return apiJson({
      entry,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "journal", failure: failureCategory(error) });

    return apiFailure(error);
  }
}

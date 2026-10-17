import { aiSecurityResponse } from "@/lib/ai/requestSecurity";
import { secureAiRoute } from "@/lib/ai/secureRoute";
import { AiInputError } from "@/lib/ai/requestSecurity";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

async function handleAiRequest(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use this feature." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return NextResponse.json(
        {
          error: "AI journal summaries are available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const entryId = body.entryId as string | undefined;

    if (!entryId) {
      return NextResponse.json(
        { error: "Journal entry ID is required." },
        { status: 400 }
      );
    }

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Journal entry not found." },
        { status: 404 }
      );
    }

    if (entry.content.length > 40_000) throw new AiInputError("Journal entry is too long to summarize.", 413);

    const prompt = `
Help organize this Orthodox Christian journal entry.

Journal title:
${entry.title ?? "Untitled reflection"}

Journal content:
${entry.content}

Return:
1. A short neutral summary
2. Main themes
3. One gentle reflection question
4. Questions the user may consider bringing to a priest

Important:
- Do not diagnose the user's spiritual state.
- Do not act as a confessor.
- Do not replace pastoral guidance.
- Keep the tone calm, careful, and practical.
`;

    const result = await generateOrthodoxAnswer({
      userMessage: prompt,
      contextKey: "journal",
      isPro: true,
    });

    const updatedEntry = await prisma.journalEntry.update({
      where: {
        id: entry.id,
      },
      data: {
        aiSummary: result.answer,
      },
    });

    return NextResponse.json({
      entry: updatedEntry,
      summary: result.answer,
    });
  } catch (error) {
    const securityError = aiSecurityResponse(error);
    if (securityError) return securityError;
    console.error("JOURNAL_SUMMARY_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while summarizing the journal entry." },
      { status: 500 }
    );
  }
}
export const POST = secureAiRoute(handleAiRequest, "journal-summary");

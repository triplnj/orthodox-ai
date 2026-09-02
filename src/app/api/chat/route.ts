import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { canUseChat, logUsage } from "@/lib/usage";
import { isProUser } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/auth";
import type { ChatContextKey } from "@/lib/ai/chatContexts";
import { getUserProfileContext } from "@/lib/userProfileContext";
import { buildPatristicContext } from "@/lib/patristics/build-chat-context";
import { detectPatristicLanguage } from "@/lib/patristics/detect-language";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to use OrthodoxAI.",
        },
        {
          status: 401,
        },
      );
    }

    const body = await req.json();

    const message =
      body.message as string | undefined;

    const contextKey =
      body.contextKey as
        | ChatContextKey
        | undefined;

    const extraContext =
      body.extraContext as
        | string
        | undefined;

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        {
          status: 400,
        },
      );
    }

    const permission =
      await canUseChat(user);

    if (!permission.allowed) {
      return NextResponse.json(
        {
          error: permission.reason,

          upgradeRequired:
            permission.limitType ===
              "daily" &&
            !isProUser(user),

          rateLimited:
            permission.limitType ===
            "rate",

          limitType:
            permission.limitType,

          remaining:
            permission.remaining,

          dailyLimit:
            permission.dailyLimit,

          plan: user.plan,
        },
        {
          status: permission.status,
        },
      );
    }

    const trimmedMessage =
      message.trim();

    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: "user",
        content: trimmedMessage,
        category:
          contextKey ?? "general",
      },
    });

    const userProfileContext =
      await getUserProfileContext(
        user.id,
      );

    const language =
      detectPatristicLanguage(
        trimmedMessage,
      );

    /*
     * IMPORTANT:
     *
     * Chat only searches the already
     * verified local patristic database.
     *
     * Internet discovery, source fetching,
     * attribution verification,
     * second-source verification and
     * embeddings must NOT run inside
     * this HTTP request.
     */
    const patristicContext =
      await buildPatristicContext(
        trimmedMessage,
        language,
      );

    console.log(
      "PATRISTIC_CHAT_CONTEXT:",
      {
        query: trimmedMessage,
        language,
        found:
          Boolean(patristicContext),
      },
    );

    const combinedExtraContext = `
${userProfileContext}

Page or feature extra context:
${extraContext ?? "No additional page context provided."}

VERIFIED PATRISTIC DATABASE CONTEXT:

${
  patristicContext ||
  "NO VERIFIED PATRISTIC RECORD WAS RETRIEVED."
}

STRICT PATRISTIC CITATION RULES:

1. PATRISTIC_RECORD entries are authoritative database material for this answer.

CRITICAL CITATION RULES:

- Treat every [PATRISTIC_RECORD_n] as a completely separate source record.

- A quotation may use ONLY the AUTHOR, WORK, SECTION, CHAPTER, PARAGRAPH, REFERENCE, and VERIFIED_SOURCES contained inside that same PATRISTIC_RECORD.

- Never transfer or combine a REFERENCE or source URL from one PATRISTIC_RECORD to another.

- If a record says REFERENCE: Not specified, do not supply a reference from another record or from model memory.

- When citing multiple patristic quotations, cite each quotation separately with its own available metadata.

- A PG, SC, CPG, section, chapter, paragraph, or URL applies only to the PATRISTIC_RECORD in which it appears.

2. If you place words attributed to a Church Father inside quotation marks,
you MUST copy QUOTE_TO_USE exactly.

Never rewrite, improve, shorten, combine, reconstruct or paraphrase a quotation.

3. Never create a quotation from your general model knowledge.

4. When using a quotation, identify:
- author
- work
- section/chapter when available
- PG or other reference when available.

5. SOURCE URL IS MANDATORY WHEN A PATRISTIC_RECORD IS USED:

- If you use any quotation or attribution from a PATRISTIC_RECORD,
  and that record contains one or more VERIFIED_SOURCES URLs,
  you MUST print at least one of those URLs in the final answer.

- Copy the URL exactly as supplied inside that same PATRISTIC_RECORD.

- Display it immediately after the quotation or its bibliographic reference
  in this form:

  Source: <exact VERIFIED_SOURCES URL>

- Do not replace the URL with phrases such as
  "verified source",
  "patristic database",
  "source from the database",
  or any other description.

- If two VERIFIED_SOURCES URLs are supplied, you may display both.

- Never invent, reconstruct, shorten, modify, or guess a URL.

6. The quotation must be in the user's language:

- English question -> use the supplied English QUOTE_TO_USE.

- Serbian question -> use the supplied Serbian QUOTE_TO_USE.

The ORIGINAL_TEXT may additionally be shown when useful.

7. Do not claim:

"St. X says..."
"St. X teaches..."
"According to St. X..."

unless the claim is directly supported by one of the retrieved
PATRISTIC_RECORD entries.

8. You MAY explain the theological meaning after the citation,
but distinguish your explanation from the Father's actual words.

9. Do not turn your explanation into an attributed teaching.

For example, prefer:

"This can be understood as..."

instead of:

"St. John also teaches..."

unless another retrieved record supports that statement.

10. If no verified database record was retrieved:

- If the user's question asks what a specific Church Father, saint,
  council, patristic author, or patristic work says or teaches,
  do NOT answer from general model knowledge.

- Do not attribute any doctrine, opinion, interpretation, quotation,
  paraphrase, summary, or theological position to that person or work
  unless it is directly supported by a retrieved PATRISTIC_RECORD.

- Clearly tell the user that OrthodoxAI could not currently retrieve
  sufficiently verified source material for that attribution.

- Keep this response concise. Do not perform or claim to perform
  an internet search inside the current chat request.

- You may answer only the general theological subject without attributing
  the answer to the requested Father or work, and you must clearly label
  that material as a general explanation rather than the teaching of the
  requested author.

- Never fabricate patristic quotations.

- Never invent PG, SC, CPG, chapter, homily, paragraph, work title,
  source URL, or other bibliographic references.

11. Never describe an OrthodoxAI-generated translation as an official
published translation unless the database explicitly identifies it as one.

12. A VERIFIED_SOURCES URL belongs only to the quotation with which it
was supplied.

Never attach one record's source to another quotation.
`;

    const result =
      await generateOrthodoxAnswer({
        userMessage:
          trimmedMessage,

        contextKey:
          contextKey ?? "general",

        extraContext:
          combinedExtraContext,

        isPro:
          isProUser(user),
      });

    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: "assistant",
        content: result.answer,
        category:
          contextKey ?? "general",
      },
    });

    await logUsage(
      user.id,
      "chat",
    );

    const remaining =
      permission.remaining === null
        ? null
        : Math.max(
            0,
            permission.remaining -
              1,
          );

    return NextResponse.json({
      answer: result.answer,
      remaining,
      dailyLimit:
        permission.dailyLimit,
      plan: user.plan,
    });
  } catch (error) {
    console.error(
      "CHAT_API_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while generating the answer.",
      },
      {
        status: 500,
      },
    );
  }
}
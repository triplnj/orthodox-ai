import {
  NextResponse,
} from "next/server";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateOrthodoxAnswer,
} from "@/lib/ai/chatService";

import {
  canUseChat,
  logUsage,
} from "@/lib/usage";

import {
  isProUser,
} from "@/lib/subscription";

import {
  getCurrentUser,
} from "@/lib/auth";

import type {
  ChatContextKey,
} from "@/lib/ai/chatContexts";

import {
  getUserProfileContext,
} from "@/lib/userProfileContext";

import {
  buildLivePgChatContext,
  type LivePgSource,
} from "@/lib/patristics/build-live-pg-chat-context";


function formatPgSources(
  sources: LivePgSource[],
) {
  if (
    sources.length === 0
  ) {
    return "";
  }


  const seen =
    new Set<string>();

  const lines:
    string[] = [];


  for (
    const source of sources
  ) {
    const key =
      [
        source.pgVolume,
        source.scanPage,
        source.pageImageUrl,
      ].join(":");


    if (
      seen.has(key)
    ) {
      continue;
    }


    seen.add(key);


    const reference =
      source.pgReference
        ? source.pgReference
        : `PG ${source.pgVolume}, digital scan page ${source.scanPage}`;


    lines.push(
      `${reference}\n${source.pageImageUrl}`,
    );
  }


  if (
    lines.length === 0
  ) {
    return "";
  }


  /*
   * Остављамо URL као чист URL.
   *
   * То значи да чак и ако frontend
   * тренутно нема Markdown renderer,
   * корисник ипак види стварни
   * директни source URL.
   */
  return [
    "",
    "",
    "Sources — Patrologia Graeca:",
    "",
    ...lines,
  ].join("\n");
}


export async function POST(
  req: Request,
) {
  try {
    const user =
      await getCurrentUser();


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


    const body =
      await req.json();


    const message =
      body.message as
        | string
        | undefined;

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
      typeof message !==
        "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Message is required.",
        },
        {
          status: 400,
        },
      );
    }


    const normalizedMessage =
      message.trim();


    const permission =
      await canUseChat(
        user,
      );


    if (
      !permission.allowed
    ) {
      return NextResponse.json(
        {
          error:
            permission.reason,

          upgradeRequired:
            true,
        },
        {
          status: 403,
        },
      );
    }


    /*
     * ------------------------------------------------
     * 1. Сачувај корисничко питање
     * ------------------------------------------------
     */
    await prisma.chatMessage.create({
      data: {
        userId:
          user.id,

        role:
          "user",

        content:
          normalizedMessage,

        category:
          contextKey ??
          "general",
      },
    });


    /*
     * ------------------------------------------------
     * 2. Кориснички профил
     * ------------------------------------------------
     */
    const userProfileContext =
      await getUserProfileContext(
        user.id,
      );


    /*
     * ------------------------------------------------
     * 3. LIVE PG RETRIEVAL
     * ------------------------------------------------
     *
     * Ово је веза која је недостајала.
     *
     * Исти retrieval који смо
     * тестирали преко pg-general-test
     * сада ради директно из /chat.
     *
     * Ако питање нема конкретног
     * PG аутора, searchPgPassages
     * ће вратити празан резултат.
     *
     * Ако PG retrieval падне,
     * helper враћа null и обични
     * chat наставља да ради.
     */
    const livePg =
      await buildLivePgChatContext(
        normalizedMessage,
      );


    const combinedExtraContext = `
${userProfileContext}

Page or feature extra context:
${extraContext ?? "No additional page context provided."}
    `.trim();


    /*
     * ------------------------------------------------
     * 4. Генериши одговор
     * ------------------------------------------------
     */
    const result =
      await generateOrthodoxAnswer({
        userMessage:
          normalizedMessage,

        contextKey:
          contextKey ??
          "general",

        extraContext:
          combinedExtraContext,

        patristicContext:
          livePg?.context ??
          null,

        isPro:
          isProUser(
            user,
          ),
      });


    /*
     * ------------------------------------------------
     * 5. Изворе додајемо ДЕТЕРМИНИСТИЧКИ
     * ------------------------------------------------
     *
     * Не препуштамо AI-ју да
     * измишља или преписује URL.
     *
     * Линкови долазе директно
     * из retrieval резултата.
     */
    const sourceBlock =
      livePg
        ? formatPgSources(
            livePg.sources,
          )
        : "";


    const finalAnswer =
      `${result.answer}${sourceBlock}`;


    /*
     * ------------------------------------------------
     * 6. Сачувај assistant одговор
     * ------------------------------------------------
     */
    await prisma.chatMessage.create({
      data: {
        userId:
          user.id,

        role:
          "assistant",

        content:
          finalAnswer,

        category:
          contextKey ??
          "general",
      },
    });


    /*
     * ------------------------------------------------
     * 7. Usage
     * ------------------------------------------------
     */
    await logUsage(
      user.id,
      "chat",
    );


    /*
     * ------------------------------------------------
     * 8. Response
     * ------------------------------------------------
     */
    return NextResponse.json({
      answer:
        finalAnswer,

      remaining:
        permission.remaining,

      plan:
        user.plan,

      /*
       * Корисно и за каснији
       * frontend source-card UI.
       */
      patristicSources:
        livePg?.sources ??
        [],

      usedLivePg:
        Boolean(
          livePg &&
          livePg.sources.length >
            0,
        ),
    });

  } catch (
    error
  ) {
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
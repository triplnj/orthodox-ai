import { aiSecurityResponse } from "@/lib/ai/requestSecurity";
import { secureAiRoute } from "@/lib/ai/secureRoute";
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
  buildPatristicResearchContext,
} from "@/lib/patristics/build-patristic-research-context";

async function handleAiRequest(
  req: Request,
  reservation: { id: string; remaining: number },
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

    const userProfileContext =
      await getUserProfileContext(
        user.id,
      );

    /*
     * Central patristic research router.
     *
     * The chat API no longer knows whether evidence
     * comes from the verified database, PG, or future
     * corpus providers. It receives one normalized
     * research context plus structured source metadata.
     */
    const patristicResearch =
      await buildPatristicResearchContext(
        normalizedMessage,
      );

    const combinedExtraContext = `
${userProfileContext}

Page or feature extra context:
${extraContext ?? "No additional page context provided."}
    `.trim();

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
          patristicResearch
            ?.context ??
          null,

        isPro:
          isProUser(
            user,
          ),
      });

    /*
     * Source URLs are returned as structured metadata
     * and rendered by the chat UI as clickable cards.
     * Do not duplicate them inside the answer text.
     */
    const finalAnswer =
      result.answer;

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

    return NextResponse.json({
      answer:
        finalAnswer,

      remaining:
        reservation.remaining,

      plan:
        user.plan,

      patristicSources:
        patristicResearch
          ?.sources ??
        [],

      usedPatristicResearch:
        Boolean(
          patristicResearch &&
          patristicResearch
            .sources.length >
            0,
        ),

      /*
       * Kept for compatibility with any existing
       * client code that still expects this flag.
       */
      usedLivePg:
        Boolean(
          patristicResearch
            ?.sources.some(
              (source) =>
                source.provider ===
                "PATROLOGIA_GRAECA",
            ),
        ),

      patristicProviders:
        patristicResearch
          ?.providersSucceeded ??
        [],
    });

  } catch (
    error
  ) {
    const securityError = aiSecurityResponse(error);
    if (securityError) return securityError;
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

export const POST = secureAiRoute(handleAiRequest, "chat");

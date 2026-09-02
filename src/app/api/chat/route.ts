import {
  NextResponse,
} from "next/server";

import {
  start,
} from "workflow/api";

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
  buildPatristicContext,
} from "@/lib/patristics/build-chat-context";

import {
  enqueuePatristicDiscovery,
} from "@/lib/patristics/enqueue-discovery";

import {
  patristicDiscoveryWorkflow,
} from "@/workflows/patristic-discovery";


function detectChatLanguage(
  message: string,
): "sr" | "en" {
  /*
   * Cyrillic Serbian.
   */
  if (
    /[А-Яа-яЉљЊњЋћЂђЖжЧчШш]/u.test(
      message,
    )
  ) {
    return "sr";
  }


  /*
   * Serbian Latin characters.
   */
  if (
    /[čćžšđČĆŽŠĐ]/u.test(
      message,
    )
  ) {
    return "sr";
  }


  /*
   * Frequent Serbian Latin words.
   */
  if (
    /\b(šta|sto|sveti|svetog|svetom|duša|duse|duši|molitva|molitvi|pokajanje|bog|božji|crkva|crkveni|oci|otac|uči|piše|govori|kako|zašto)\b/iu.test(
      message,
    )
  ) {
    return "sr";
  }


  return "en";
}


function isPatristicResearchQuestion(
  message: string,
) {
  return (
    /\bchurch fathers?\b/iu.test(
      message,
    ) ||

    /\bholy fathers?\b/iu.test(
      message,
    ) ||

    /\bpatristic\b/iu.test(
      message,
    ) ||

    /\bsaint\s+[a-z]/iu.test(
      message,
    ) ||

    /\bst\.?\s+[a-z]/iu.test(
      message,
    ) ||

    /\bsveti\b/iu.test(
      message,
    ) ||

    /\bsvetog\b/iu.test(
      message,
    ) ||

    /\bcrkveni oci\b/iu.test(
      message,
    ) ||

    /свет[иогм]/iu.test(
      message,
    ) ||

    /црквен[иих]+\s+оц/iu.test(
      message,
    ) ||

    /свети\s+оци/iu.test(
      message,
    )
  );
}


function researchMessage(
  language: "sr" | "en",
) {
  if (
    language === "sr"
  ) {
    return [
      "За ово питање тренутно немам довољно верификованог патристичког материјала у локалној бази.",
      "",
      "Покренуо сам претрагу проверених патристичких извора. Систем сада тражи релевантан текст, проверава да ли цитат заиста постоји у извору, проверава ауторство и тражи независни други извор.",
      "",
      "Када се провера заврши, исти упит ће моћи да користи нове верификоване записе.",
    ].join("\n");
  }


  return [
    "I do not yet have enough verified patristic material in the local corpus for this question.",
    "",
    "A search of trusted patristic sources has now been started. The system will locate relevant passages, verify the exact text and attribution, and seek an independent second source.",
    "",
    "Once verification is complete, the same question can use the newly verified records.",
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


    const cleanMessage =
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
     * Store user message.
     */
    await prisma
      .chatMessage
      .create({
        data: {
          userId:
            user.id,

          role:
            "user",

          content:
            cleanMessage,

          category:
            contextKey ??
            "general",
        },
      });


    const language =
      detectChatLanguage(
        cleanMessage,
      );


    const patristicQuestion =
      isPatristicResearchQuestion(
        cleanMessage,
      );


    /*
     * Search our already verified
     * local corpus first.
     */
    let patristicContext =
      "";


    if (
      patristicQuestion
    ) {
      patristicContext =
        await buildPatristicContext(
          cleanMessage,
          language,
        );
    }


    /*
     * If this is explicitly a patristic
     * question and our verified corpus
     * has nothing sufficiently relevant,
     * start durable background discovery.
     *
     * Do NOT ask the language model to
     * invent an answer about that Father.
     */
    if (
      patristicQuestion &&
      !patristicContext.trim()
    ) {
      const job =
        await enqueuePatristicDiscovery({
          query:
            cleanMessage,

          language,
        });


      if (
        job &&
        (
          job.status ===
            "PENDING" ||
          job.status ===
            "PROCESSING"
        )
      ) {
        /*
         * Only PENDING jobs need a new
         * Workflow start.
         *
         * PROCESSING means a run already
         * exists or is already underway.
         */
        if (
          job.status ===
          "PENDING"
        ) {
          try {
            const run =
              await start(
                patristicDiscoveryWorkflow,
                [
                  job.id,
                  job.query,
                  language,
                ],
              );


            console.log(
              "PATRISTIC_CHAT_WORKFLOW_STARTED:",
              {
                jobId:
                  job.id,

                runId:
                  run.runId,

                query:
                  cleanMessage,
              },
            );
          } catch (error) {
            /*
             * Chat itself should not crash
             * merely because Workflow start
             * failed.
             */
            console.error(
              "PATRISTIC_CHAT_WORKFLOW_START_ERROR:",
              error,
            );
          }
        }
      }


      const answer =
        researchMessage(
          language,
        );


      await prisma
        .chatMessage
        .create({
          data: {
            userId:
              user.id,

            role:
              "assistant",

            content:
              answer,

            category:
              contextKey ??
              "general",
          },
        });


      await logUsage(
        user.id,
        "chat",
      );


      return NextResponse.json({
        answer,

        patristicResearch:
          true,

        discoveryJobId:
          job?.id ??
          null,

        discoveryStatus:
          job?.status ??
          null,

        remaining:
          permission.remaining,

        plan:
          user.plan,
      });
    }


    /*
     * Normal answering path:
     *
     * either
     * - non-patristic question
     * or
     * - verified patristic material exists.
     */
    const userProfileContext =
      await getUserProfileContext(
        user.id,
      );


    const combinedExtraContext = `
${userProfileContext}

Page or feature extra context:

${
  extraContext ??
  "No additional page context provided."
}
`.trim();


    const result =
      await generateOrthodoxAnswer({
        userMessage:
          cleanMessage,

        contextKey:
          contextKey ??
          "general",

        extraContext:
          combinedExtraContext,

        isPro:
          isProUser(
            user,
          ),

        patristicContext:
          patristicContext ||
          undefined,
      });


    await prisma
      .chatMessage
      .create({
        data: {
          userId:
            user.id,

          role:
            "assistant",

          content:
            result.answer,

          category:
            contextKey ??
            "general",
        },
      });


    await logUsage(
      user.id,
      "chat",
    );


    return NextResponse.json({
      answer:
        result.answer,

      patristicResearch:
        false,

      remaining:
        permission.remaining,

      plan:
        user.plan,
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
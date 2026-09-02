import {
  NextResponse,
} from "next/server";

import {
  start,
} from "workflow/api";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  prisma,
} from "@/lib/prisma";

import {
  canUseChat,
  logUsage,
} from "@/lib/usage";

import {
  generateOrthodoxAnswer,
} from "@/lib/ai/chatService";

import {
  buildPatristicContext,
} from "@/lib/patristics/build-chat-context";

import {
  enqueuePatristicDiscovery,
} from "@/lib/patristics/enqueue-discovery";

import {
  formatPatristicResearchLinks,
} from "@/lib/patristics/research-links";

import {
  patristicDiscoveryWorkflow,
} from "@/workflows/patristic-discovery";


type GenerateOrthodoxAnswerInput =
  Parameters<
    typeof generateOrthodoxAnswer
  >[0];

type ChatContextKey =
  GenerateOrthodoxAnswerInput[
    "contextKey"
  ];


function detectChatLanguage(
  message: string,
):
  | "sr"
  | "en" {
  const hasCyrillic =
    /[\u0400-\u04FF]/u.test(
      message,
    );

  const hasSerbianLatin =
    /[čćžšđ]/iu.test(
      message,
    );

  const commonSerbianWords =
    /\b(šta|шта|kako|како|zašto|зашто|sveti|свети|otac|отац|oci|оци|duša|душа|molitva|молитва|smrt|смрт)\b/iu.test(
      message,
    );

  return (
    hasCyrillic ||
    hasSerbianLatin ||
    commonSerbianWords
  )
    ? "sr"
    : "en";
}


function isPatristicResearchQuestion(
  message: string,
) {
  return (
    /\b(church fathers?|holy fathers?|patristic|saint|st\.)\b/iu.test(
      message,
    ) ||
    /\b(sveti|sv\.?|crkveni oci|sveti oci)\b/iu.test(
      message,
    ) ||
    /(свети|св\.?|свети оци|црквени оци)/iu.test(
      message,
    )
  );
}


function researchMessage(
  query: string,
  language: "sr" | "en",
) {
  const researchLinks =
    formatPatristicResearchLinks(
      query,
      language,
    );

  if (
    language === "sr"
  ) {
    return [
      "За ово питање тренутно немам довољно верификованог текста у локалној бази.",
      "",
      "Покренута је позадинска претрага примарних извора. За коначне библијске и патристичке наводе OrthodoxAI као извор прихвата Свето Писмо, Patrologia Graeca и Филокалију.",
      "",
      researchLinks,
    ].join("\n");
  }

  return [
    "I do not currently have enough verified primary-source material in the local database for this question.",
    "",
    "A background search of the primary sources has started. For final biblical and patristic quotations OrthodoxAI uses Holy Scripture, Patrologia Graeca, and the Philokalia as its authoritative corpora.",
    "",
    researchLinks,
  ].join("\n");
}


export async function POST(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request.json();

  const message =
    typeof body?.message ===
      "string"
      ? body.message.trim()
      : "";

  const contextKey =
    typeof body?.contextKey ===
      "string"
      ? (
          body.contextKey as
            ChatContextKey
        )
      : undefined;

  const extraContext =
    typeof body?.extraContext ===
      "string"
      ? body.extraContext
      : undefined;

  if (!message) {
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

  const permission =
    await canUseChat(user);

  if (!permission.allowed) {
    return NextResponse.json(
      {
        error:
          permission.reason,

        remaining:
          permission.remaining,
      },
      {
        status: 429,
      },
    );
  }

  await prisma.chatMessage.create({
    data: {
      userId:
        user.id,

      role:
        "USER",

      content:
        message,
    },
  });

  const language =
    detectChatLanguage(
      message,
    );

  const isPatristic =
    isPatristicResearchQuestion(
      message,
    );

  let patristicContext = "";

  if (isPatristic) {
    patristicContext =
      await buildPatristicContext(
        message,
        language,
      );
  }

  if (
    isPatristic &&
    !patristicContext
  ) {
    const job =
      await enqueuePatristicDiscovery({
        query:
          message,

        language,
      });

    if (
      job &&
      job.status ===
        "PENDING"
    ) {
      try {
        await start(
          patristicDiscoveryWorkflow,
          [
            job.id,
            job.query,
            language,
          ],
        );
      } catch (error) {
        console.error(
          "PATRISTIC_WORKFLOW_START_ERROR:",
          error,
        );
      }
    }

    const answer =
      researchMessage(
        message,
        language,
      );

    await prisma.chatMessage.create({
      data: {
        userId:
          user.id,

        role:
          "ASSISTANT",

        content:
          answer,
      },
    });

    await logUsage(
      user.id,
      "CHAT",
    );

    return NextResponse.json({
      answer,

      patristicResearch:
        true,

      discoveryJobId:
        job?.id ?? null,

      discoveryStatus:
        job?.status ?? null,
    });
  }

  const generated =
    await generateOrthodoxAnswer({
      userMessage:
        message,

      contextKey,

      extraContext,

      isPro:
        user.plan === "PRO",

      patristicContext:
        patristicContext ||
        undefined,
    });

  const answer =
    generated.answer;

  await prisma.chatMessage.create({
    data: {
      userId:
        user.id,

      role:
        "ASSISTANT",

      content:
        answer,
    },
  });

  await logUsage(
    user.id,
    "CHAT",
  );

  return NextResponse.json({
    answer,

    patristicResearch:
      false,
  });
}
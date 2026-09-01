import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { prisma } from "@/lib/prisma";
import {
  BackfillTranslationSchema,
  type BackfillTranslation,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function translateQuote(
  originalText: string,
  originalLanguage: string,
): Promise<BackfillTranslation> {
  const model = process.env.PATRISTICS_MODEL;

  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }

  const response = await openai.responses.parse({
    model,

    input: [
      {
        role: "system",
        content: `
You translate verified patristic quotations.

CRITICAL RULES:

1. Translate ONLY the supplied originalText.

2. Do not reconstruct missing words.

3. Do not use remembered published translations.

4. translationSr must be a faithful and relatively
literal Serbian translation.

5. translationEn must be a faithful and relatively
literal English translation.

6. Preserve theological terminology accurately.

7. Do not add explanations, references, quotation
marks or commentary.

8. If the original language is Serbian,
translationSr may equal originalText.

9. If the original language is English,
translationEn may equal originalText.

Original language:
${originalLanguage}
        `,
      },
      {
        role: "user",
        content: originalText,
      },
    ],

    text: {
      format: zodTextFormat(
        BackfillTranslationSchema,
        "patristic_translation",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error(
      "Translation model returned no parsed output.",
    );
  }

  return response.output_parsed;
}

export async function backfillPatristicTranslations() {
  const quotes = await prisma.patristicQuote.findMany({
    where: {
      verification: "MULTI_SOURCE_VERIFIED",
      confidence: {
        gte: 90,
      },
      OR: [
        {
          translationSr: null,
        },
        {
          translationEn: null,
        },
      ],
    },

    select: {
      id: true,
      originalLanguage: true,
      originalText: true,
      translationSr: true,
      translationEn: true,
    },
  });

  let updated = 0;
  let failed = 0;

  for (const quote of quotes) {
    try {
      const translation = await translateQuote(
        quote.originalText,
        quote.originalLanguage,
      );

      await prisma.patristicQuote.update({
        where: {
          id: quote.id,
        },

        data: {
          translationSr:
            quote.translationSr ??
            translation.translationSr,

          translationEn:
            quote.translationEn ??
            translation.translationEn,
        },
      });

      updated += 1;
    } catch (error) {
      failed += 1;

      console.error(
        `Translation backfill failed for quote ${quote.id}:`,
        error,
      );
    }
  }

  return {
    total: quotes.length,
    updated,
    failed,
  };
}
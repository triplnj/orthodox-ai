import OpenAI from "openai";

import type {
  PgPassageMatch,
} from "./pg-passage-search";

import {
  getArchivePageImageUrl,
} from "./pg-page-image";


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });


const PG_ARCHIVE_IDENTIFIERS: Record<
  number,
  string
> = {
  46: "patrologiaecursu46mignuoft",
};


export type CleanedPgPassage =
  PgPassageMatch & {
    cleanedGreekText: string;

    ocrCorrectionNotes: string;

    pageVerification:
      | "VISUALLY_CHECKED"
      | "NOT_CHECKED";
  };


function getArchiveIdentifier(
  pgVolume: number,
) {
  return (
    PG_ARCHIVE_IDENTIFIERS[
      pgVolume
    ] ?? null
  );
}


async function imageUrlToDataUrl(
  imageUrl: string,
) {
  const response =
    await fetch(
      imageUrl,
      {
        redirect: "follow",

        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
        },
      },
    );


  if (!response.ok) {
    throw new Error(
      `Could not fetch PG page image: ${response.status}`,
    );
  }


  const contentType =
    response.headers.get(
      "content-type",
    ) ||
    "image/jpeg";


  const arrayBuffer =
    await response.arrayBuffer();


  const base64 =
    Buffer.from(
      arrayBuffer,
    ).toString(
      "base64",
    );


  return (
    `data:${contentType};base64,` +
    base64
  );
}


async function cleanOnePassage(
  passage: PgPassageMatch,
) {
  const archiveIdentifier =
    getArchiveIdentifier(
      passage.pgVolume,
    );


  if (!archiveIdentifier) {
    throw new Error(
      `No archive identifier configured for PG ${passage.pgVolume}.`,
    );
  }


  const imageUrl =
    getArchivePageImageUrl(
      archiveIdentifier,
      passage.scanPage,
    );


  const imageDataUrl =
    await imageUrlToDataUrl(
      imageUrl,
    );


  const response =
    await openai.responses.create({
      model:
        "gpt-4.1",

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text: [
                "You are verifying Ancient Greek OCR against a scanned page of Patrologia Graeca.",
                "",
                "The supplied OCR text comes from this exact scanned PG page.",
                "",
                "TASK:",
                "1. Locate the supplied passage visually on the scanned page.",
                "2. Correct OCR errors only where the printed Greek on the page supports the correction.",
                "3. Preserve the actual wording of the printed PG text.",
                "4. Remove OCR artifacts such as stray Latin letters, broken hyphenation, accidental punctuation, and OCR line-break damage.",
                "5. Do NOT modernize the Greek.",
                "6. Do NOT paraphrase.",
                "7. Do NOT translate.",
                "8. Do NOT complete words or sentences that are outside the visible supplied passage unless needed to repair a word split across a printed line.",
                "9. If a character or word cannot be read confidently from the scan, preserve the OCR reading rather than inventing text.",
                "",
                "Return exactly this format:",
                "",
                "CLEANED_GREEK:",
                "<corrected Greek passage>",
                "",
                "NOTES:",
                "<brief description of corrections; write NONE if no corrections were needed>",
                "",
                "OCR PASSAGE:",
                passage.originalText,
              ].join(
                "\n",
              ),
            },

            {
              type:
                "input_image",

              image_url:
                imageDataUrl,

              detail:
                "high",
            },
          ],
        },
      ],
    });


  const output =
    response.output_text.trim();


  const cleanedMatch =
    output.match(
      /CLEANED_GREEK:\s*([\s\S]*?)\s*NOTES:/i,
    );


  const notesMatch =
    output.match(
      /NOTES:\s*([\s\S]*)$/i,
    );


  const cleanedGreekText =
    cleanedMatch?.[1]?.trim() ||
    passage.originalText;


  const ocrCorrectionNotes =
    notesMatch?.[1]?.trim() ||
    "NONE";


  return {
    ...passage,

    cleanedGreekText,

    ocrCorrectionNotes,

    pageVerification:
      "VISUALLY_CHECKED" as const,
  };
}


export async function cleanPgOcrPassages(
  passages:
    PgPassageMatch[],

  limit = 3,
): Promise<
  CleanedPgPassage[]
> {
  const selected =
    passages.slice(
      0,
      limit,
    );


  const results:
    CleanedPgPassage[] =
    [];


  /*
   * Намерно секвенцијално.
   *
   * Свака страница иде засебно
   * како не бисмо истовремено
   * слали више великих PG слика.
   */
  for (
    const passage
    of selected
  ) {
    const cleaned =
      await cleanOnePassage(
        passage,
      );


    results.push(
      cleaned,
    );
  }


  return results;
}
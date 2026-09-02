import OpenAI from "openai";

import type {
  CleanedPgPassage,
} from "./clean-pg-ocr";

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


export type VerifiedCleanedPgPassage =
  CleanedPgPassage & {
    scanVerification:
      | "SCAN_VERIFIED"
      | "SCAN_UNCERTAIN"
      | "SCAN_REJECTED";

    verificationNotes: string;

    verifiedGreekText: string;
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


  const bytes =
    await response.arrayBuffer();


  return (
    `data:${contentType};base64,` +
    Buffer.from(
      bytes,
    ).toString(
      "base64",
    )
  );
}


async function verifyOne(
  passage: CleanedPgPassage,
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
      model: "gpt-4.1",

      input: [
        {
          role: "user",

          content: [
            {
              type: "input_text",

              text: [
                "You are performing a SECOND, independent textual verification of Ancient Greek printed in Patrologia Graeca.",
                "",
                "You are NOT allowed to improve style, grammar, spelling, or meaning.",
                "Your only authority is the visible printed Greek on the supplied scan.",
                "",
                "Compare:",
                "A. RAW OCR",
                "B. FIRST-PASS CLEANED TEXT",
                "C. THE SCANNED PAGE",
                "",
                "Pay special attention to every place where B differs from A.",
                "",
                "Reject any correction that cannot actually be supported by the visible printed page.",
                "Do not substitute a synonymous Greek word.",
                "Do not normalize a grammatical form.",
                "Do not reconstruct what you think the author probably wrote.",
                "",
                "If the scan is unclear at an altered word, mark the result UNCERTAIN.",
                "",
                "Return exactly:",
                "",
                "STATUS: VERIFIED",
                "or",
                "STATUS: UNCERTAIN",
                "or",
                "STATUS: REJECTED",
                "",
                "VERIFIED_GREEK:",
                "<text supported by the printed scan>",
                "",
                "NOTES:",
                "<mention every doubtful or rejected correction>",
                "",
                "RAW OCR:",
                passage.originalText,
                "",
                "FIRST-PASS CLEANED:",
                passage.cleanedGreekText,
              ].join("\n"),
            },

            {
              type: "input_image",

              image_url:
                imageDataUrl,

              detail: "high",
            },
          ],
        },
      ],
    });


  const output =
    response.output_text.trim();


  const statusMatch =
    output.match(
      /STATUS:\s*(VERIFIED|UNCERTAIN|REJECTED)/i,
    );


  const greekMatch =
    output.match(
      /VERIFIED_GREEK:\s*([\s\S]*?)\s*NOTES:/i,
    );


  const notesMatch =
    output.match(
      /NOTES:\s*([\s\S]*)$/i,
    );


  const rawStatus =
    statusMatch?.[1]?.toUpperCase();


  const scanVerification =
    rawStatus === "VERIFIED"
      ? "SCAN_VERIFIED"
      : rawStatus === "REJECTED"
        ? "SCAN_REJECTED"
        : "SCAN_UNCERTAIN";


  return {
    ...passage,

    scanVerification,

    verifiedGreekText:
      greekMatch?.[1]?.trim() ||
      passage.cleanedGreekText,

    verificationNotes:
      notesMatch?.[1]?.trim() ||
      "No verification notes returned.",
  } satisfies VerifiedCleanedPgPassage;
}


export async function verifyCleanedPgPassages(
  passages: CleanedPgPassage[],
  limit = 2,
): Promise<
  VerifiedCleanedPgPassage[]
> {
  const selected =
    passages.slice(
      0,
      limit,
    );


  const results:
    VerifiedCleanedPgPassage[] =
    [];


  for (
    const passage
    of selected
  ) {
    const verified =
      await verifyOne(
        passage,
      );


    results.push(
      verified,
    );
  }


  return results;
}
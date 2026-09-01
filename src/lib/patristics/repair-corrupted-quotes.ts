import { prisma } from "@/lib/prisma";

import {
  fetchSourceText,
} from "./fetch-source";

import {
  quoteFingerprint,
} from "./fingerprint";


const REPLACEMENT_CHAR =
  "\uFFFD";


function normalizeText(
  value: string,
) {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function escapeRegExp(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}


function buildRepairPattern(
  corruptedText: string,
) {
  const normalized =
    normalizeText(
      corruptedText,
    );

  const parts =
    normalized.split(
      REPLACEMENT_CHAR,
    );

  const pattern =
    parts
      .map(
        (part) =>
          escapeRegExp(part),
      )
      .join("([\\s\\S])");

  return new RegExp(
    pattern,
    "gu",
  );
}


function findRepairCandidates(
  corruptedText: string,
  sourceText: string,
) {
  const normalizedSource =
    normalizeText(
      sourceText,
    );

  const pattern =
    buildRepairPattern(
      corruptedText,
    );

  const matches: string[] =
    [];

  for (
    const match of
    normalizedSource.matchAll(
      pattern,
    )
  ) {
    if (match[0]) {
      matches.push(
        match[0],
      );
    }
  }

  return Array.from(
    new Set(
      matches,
    ),
  );
}


export async function inspectCorruptedQuotes() {

  const quotes =
    await prisma
      .patristicQuote
      .findMany({
        where: {
          verification:
            "TEXT_VERIFIED",

          originalText: {
            contains:
              REPLACEMENT_CHAR,
          },
        },

        include: {
          sources: true,
        },
      });


  const results = [];


  for (const quote of quotes) {

    const source =
      quote.sources[0];

    if (!source) {
      results.push({
        id:
          quote.id,

        status:
          "NO_SOURCE",

        currentText:
          quote.originalText,

        repairedText:
          null,

        candidates:
          0,
      });

      continue;
    }


    try {

      const fetched =
        await fetchSourceText(
          source.url,
        );


      const candidates =
        findRepairCandidates(
          quote.originalText,
          fetched.text,
        );


      if (
        candidates.length === 1
      ) {
        const repairedText =
          candidates[0];

        const newFingerprint =
          quoteFingerprint(
            quote.authorName,
            quote.workTitle,
            repairedText,
          );


        const collision =
          await prisma
            .patristicQuote
            .findUnique({
              where: {
                fingerprint:
                  newFingerprint,
              },

              select: {
                id: true,
                originalText: true,
                verification: true,
                confidence: true,
              },
            });


        const fingerprintCollision =
          collision !== null &&
          collision.id !==
            quote.id;


        results.push({
          id:
            quote.id,

          status:
            fingerprintCollision
              ? "FINGERPRINT_COLLISION"
              : "UNIQUE_MATCH",

          sourceUrl:
            source.url,

          currentText:
            quote.originalText,

          repairedText,

          candidates:
            1,

          newFingerprint,

          fingerprintCollision,

          collision:
            fingerprintCollision
              ? collision
              : null,
        });

        continue;
      }


      results.push({
        id:
          quote.id,

        status:
          candidates.length === 0
            ? "NO_MATCH"
            : "AMBIGUOUS",

        sourceUrl:
          source.url,

        currentText:
          quote.originalText,

        repairedText:
          null,

        candidates:
          candidates.length,
      });

    } catch (error) {

      results.push({
        id:
          quote.id,

        status:
          "FETCH_ERROR",

        sourceUrl:
          source.url,

        currentText:
          quote.originalText,

        repairedText:
          null,

        candidates:
          0,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  }


  return {
    total:
      quotes.length,

    uniqueMatches:
      results.filter(
        (result) =>
          result.status ===
          "UNIQUE_MATCH",
      ).length,

    collisions:
      results.filter(
        (result) =>
          result.status ===
          "FINGERPRINT_COLLISION",
      ).length,

    unresolved:
      results.filter(
        (result) =>
          result.status !==
          "UNIQUE_MATCH",
      ).length,

    results,
  };
}


export async function repairCorruptedQuotes() {

  /*
   * Always perform a fresh preflight.
   * We never trust the result of an
   * earlier dry-run.
   */
  const inspection =
    await inspectCorruptedQuotes();


  if (
    inspection.total === 0
  ) {
    return {
      repaired: 0,
      message:
        "No corrupted TEXT_VERIFIED quotes found.",
      ids: [],
    };
  }


  if (
    inspection.unresolved !== 0 ||
    inspection.collisions !== 0
  ) {
    throw new Error(
      [
        "Repair aborted.",
        `total=${inspection.total}`,
        `uniqueMatches=${inspection.uniqueMatches}`,
        `collisions=${inspection.collisions}`,
        `unresolved=${inspection.unresolved}`,
      ].join(" "),
    );
  }


  const repairs =
    inspection.results.map(
      (result) => {

        if (
          result.status !==
            "UNIQUE_MATCH" ||
          !result.repairedText ||
          !result.newFingerprint
        ) {
          throw new Error(
            `Unexpected repair state for quote ${result.id}.`,
          );
        }


        if (
          result.repairedText.includes(
            REPLACEMENT_CHAR,
          )
        ) {
          throw new Error(
            `Repair for quote ${result.id} still contains U+FFFD.`,
          );
        }


        return {
          id:
            result.id,

          currentText:
            result.currentText,

          repairedText:
            result.repairedText,

          newFingerprint:
            result.newFingerprint,
        };
      },
    );


  /*
   * All database changes happen together.
   * If even one update fails, Prisma rolls
   * back the whole transaction.
   */
  await prisma.$transaction(
    repairs.map(
      (repair) =>
        prisma.patristicQuote.update({
          where: {
            id:
              repair.id,

            /*
             * Optimistic safety check:
             * update only if the quote still
             * contains exactly the text we
             * inspected above.
             */
            originalText:
              repair.currentText,
          },

          data: {
            originalText:
              repair.repairedText,

            fingerprint:
              repair.newFingerprint,
          },
        }),
    ),
  );


  return {
    repaired:
      repairs.length,

    message:
      "Corrupted quotations repaired successfully.",

    ids:
      repairs.map(
        (repair) =>
          repair.id,
      ),
  };
}
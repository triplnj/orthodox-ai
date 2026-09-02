import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  searchPgPassages,
} from "@/lib/patristics/pg-passage-search";

import {
  cleanPgOcrPassages,
} from "@/lib/patristics/clean-pg-ocr";

import {
  verifyCleanedPgPassages,
} from "@/lib/patristics/verify-cleaned-pg";

import {
  mapPgScanPageToColumns,
} from "@/lib/patristics/pg-column-map";


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


  const query =
    typeof body?.query ===
      "string"
      ? body.query.trim()
      : "";


  if (!query) {
    return NextResponse.json(
      {
        error:
          "Query is required.",
      },
      {
        status: 400,
      },
    );
  }


  try {
    /*
     * Прво узимамо само два
     * релевантна пасуса.
     */
    const passages =
      await searchPgPassages(
        query,
        2,
      );


    /*
     * Први визуелни пролаз:
     * OCR -> cleaned Greek.
     */
    const cleaned =
      await cleanPgOcrPassages(
        passages,
        2,
      );


    /*
     * Други независни пролаз:
     * cleaned Greek -> scan verification.
     */
    const verified =
      await verifyCleanedPgPassages(
        cleaned,
        2,
      );


    const results =
      verified.map(
        (passage) => {
          const columns =
            mapPgScanPageToColumns(
              passage.pgVolume,
              passage.scanPage,
            );


          return {
            authorName:
              passage.authorName,

            candidateWorkTitles:
              passage.candidateWorkTitles,

            pgVolume:
              passage.pgVolume,

            scanPage:
              passage.scanPage,

            pgReference:
              columns.firstColumn &&
              columns.secondColumn
                ? `PG ${passage.pgVolume}, cols. ${columns.firstColumn}–${columns.secondColumn}`
                : `PG ${passage.pgVolume}`,

            matchedTerms:
              passage.matchedTerms,

            rawOcr:
              passage.originalText,

            cleanedGreekText:
              passage.cleanedGreekText,

            verifiedGreekText:
              passage.verifiedGreekText,

            firstPassNotes:
              passage.ocrCorrectionNotes,

            scanVerification:
              passage.scanVerification,

            verificationNotes:
              passage.verificationNotes,

            pageImageUrl:
              passage.pageImageUrl,
          };
        },
      );


    return NextResponse.json({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    console.error(
      "PG_VERIFY_CLEAN_TEST_ERROR:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PG verification test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
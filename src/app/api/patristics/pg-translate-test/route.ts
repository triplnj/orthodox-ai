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
  translatePgPassages,
} from "@/lib/patristics/translate-pg-passages";

import {
  mapScanPageToPgColumns,
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
    const passages =
      await searchPgPassages(
        query,
        3,
      );


    const translated =
      await translatePgPassages(
        query,
        passages,
        3,
      );


    const results =
      translated.map(
        (passage) => {
          const columns =
            mapScanPageToPgColumns(
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

            pgFirstColumn:
              columns.pgFirstColumn,

            pgSecondColumn:
              columns.pgSecondColumn,

            pgReference:
              columns.pgFirstColumn &&
              columns.pgSecondColumn
                ? `PG ${passage.pgVolume}, cols. ${columns.pgFirstColumn}–${columns.pgSecondColumn}`
                : `PG ${passage.pgVolume}`,

            matchedTerms:
              passage.matchedTerms,

            originalText:
              passage.originalText,

            translation:
              passage.translation,

            answerLanguage:
              passage.answerLanguage,

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
      "PG_TRANSLATE_TEST_ERROR:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PG translation test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
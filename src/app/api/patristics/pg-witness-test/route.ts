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
  fetchGreekWitnessText,
} from "@/lib/patristics/greek-witness";

import {
  findGreekWitnessPassage,
} from "@/lib/patristics/find-greek-witness-passage";

import {
  compareGreekTexts,
} from "@/lib/patristics/compare-greek-texts";

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
     * За тест задржавамо само
     * два резултата.
     */
    const passages =
      await searchPgPassages(
        query,
        2,
      );


    /*
     * Први визуелни пролаз
     * чисти очигледне OCR грешке.
     */
    const cleaned =
      await cleanPgOcrPassages(
        passages,
        2,
      );


    const witnessCache =
      new Map<
        number,
        Awaited<
          ReturnType<
            typeof fetchGreekWitnessText
          >
        >
      >();


    const results = [];


    for (
      const passage
      of cleaned
    ) {
      let witness =
        witnessCache.get(
          passage.pgVolume,
        );


      if (!witness) {
        witness =
          await fetchGreekWitnessText(
            passage.pgVolume,
          );


        witnessCache.set(
          passage.pgVolume,
          witness,
        );
      }


      const located =
        findGreekWitnessPassage(
          passage.cleanedGreekText,
          witness.text,
        );


      /*
       * Comparator сада упоређује
       * очишћени пасус са прозором
       * који је matcher нашао.
       */
      const comparison =
        located.found
          ? compareGreekTexts(
              passage.cleanedGreekText,
              located.matchedText,
            )
          : null;


      const columns =
        mapPgScanPageToColumns(
          passage.pgVolume,
          passage.scanPage,
        );


      results.push({
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

        cleanedGreekText:
          passage.cleanedGreekText,

        witnessSource: {
          name:
            witness.source.sourceName,

          workTitle:
            witness.source.workTitle,

          url:
            witness.source.sourceUrl,
        },

        witnessMatch: {
          found:
            located.found,

          similarity:
            located.similarity,

          queryWordCount:
            located.queryWordCount,

          matchedWordCount:
            located.matchedWordCount,

          startWordIndex:
            located.startWordIndex,

          endWordIndex:
            located.endWordIndex,

          matchedText:
            located.matchedText,
        },

        comparison:
          comparison
            ? {
                similarity:
                  comparison.similarity,

                matchedWordCount:
                  comparison.matchedWordCount,

                leftWordCount:
                  comparison.leftWordCount,

                rightWordCount:
                  comparison.rightWordCount,

                /*
                 * Не враћамо стотине
                 * разлика у тесту.
                 */
                firstDifferences:
                  comparison.differingPositions.slice(
                    0,
                    30,
                  ),
              }
            : null,

        pageImageUrl:
          passage.pageImageUrl,
      });
    }


    return NextResponse.json({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    console.error(
      "PG_WITNESS_TEST_ERROR:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PG witness test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
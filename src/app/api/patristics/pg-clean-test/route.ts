import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  searchPgPassages,
} from "@/lib/patristics/pg-passage-search";

import {
  cleanPgOcrPassages,
} from "@/lib/patristics/clean-pg-ocr";

import {
  mapScanPageToPgColumns,
} from "@/lib/patristics/pg-column-map";


async function handleResearch(
  request: Request,
) {


  const body =
    await request.json();


  const query =
    typeof body?.query ===
      "string"
      ? body.query.trim()
      : "";


  if (!query) {
    return apiJson(
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
     * За први тест узимамо само
     * два пасуса.
     *
     * Желимо прво да проверимо
     * квалитет визуелне корекције,
     * а не брзину.
     */
    const passages =
      await searchPgPassages(
        query,
        2,
      );


    const cleaned =
      await cleanPgOcrPassages(
        passages,
        2,
      );


    const results =
      cleaned.map(
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

            pgReference:
              columns.pgFirstColumn &&
              columns.pgSecondColumn
                ? `PG ${passage.pgVolume}, cols. ${columns.pgFirstColumn}–${columns.pgSecondColumn}`
                : `PG ${passage.pgVolume}`,

            matchedTerms:
              passage.matchedTerms,

            ocrText:
              passage.originalText,

            cleanedGreekText:
              passage.cleanedGreekText,

            ocrCorrectionNotes:
              passage.ocrCorrectionNotes,

            pageVerification:
              passage.pageVerification,

            pageImageUrl:
              passage.pageImageUrl,
          };
        },
      );


    return apiJson({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "research", failure: failureCategory(error) });


    return apiJson(
      {
        error: "PG OCR cleaning test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

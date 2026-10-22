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
  verifyCleanedPgPassages,
} from "@/lib/patristics/verify-cleaned-pg";

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


    return apiJson({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "verification", failure: failureCategory(error) });


    return apiJson(
      {
        error: "PG verification test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

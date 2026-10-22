import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  searchPgPassages,
} from "@/lib/patristics/pg-passage-search";

import {
  translatePgPassages,
} from "@/lib/patristics/translate-pg-passages";

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


    return apiJson({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "translation", failure: failureCategory(error) });


    return apiJson(
      {
        error: "PG translation test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

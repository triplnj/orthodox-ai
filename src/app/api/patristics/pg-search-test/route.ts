import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  searchPgPassages,
} from "@/lib/patristics/pg-passage-search";

import {
  mapScanPageToPgColumns,
} from "@/lib/patristics/pg-column-map";


async function handleResearch(
  request: Request,
) {


  let body: {
    query?: string;
  };


  try {
    body =
      await request.json();
  } catch {
    return apiJson(
      {
        error:
          "Invalid JSON body.",
      },
      {
        status: 400,
      },
    );
  }


  const query =
    body.query?.trim();


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
        10,
      );


    const results =
      passages.map(
        (passage) => {
          const columnMap =
            mapScanPageToPgColumns(
              passage.pgVolume,
              passage.scanPage,
            );


          return {
            ...passage,

            pgFirstColumn:
              columnMap.pgFirstColumn,

            pgSecondColumn:
              columnMap.pgSecondColumn,

            pgReference:
              columnMap.pgReference,

            pgColumnMapped:
              columnMap.mapped,
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
        error: "PG search failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

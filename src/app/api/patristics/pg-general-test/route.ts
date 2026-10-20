import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { secureResearchRoute } from "@/lib/patristics/api-security";
import {
  buildPgSearchPlan,
} from "@/lib/patristics/build-pg-search-plan";

import {
  buildGreekSearchTerms,
} from "@/lib/patristics/build-greek-search-terms";

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
    /*
     * Namerno zasebno pozivamo
     * plan i Greek terms kako
     * bismo tokom testa videli
     * šta je sistem zaključio.
     */
    const plan =
      await buildPgSearchPlan(
        query,
      );


    const greekSearch =
      await buildGreekSearchTerms(
        query,
      );


    const passages =
      await searchPgPassages(
        query,
        5,
      );


    const results =
      passages.map(
        (passage) => {
          const columns =
            mapScanPageToPgColumns(
              passage.pgVolume,
              passage.scanPage,
            );


          return {
            authorName:
              passage.authorName,

            authorSource:
              passage.authorSource,

            authorVolumeVerified:
              passage.authorVolumeVerified,

            pgVolume:
              passage.pgVolume,

            scanPage:
              passage.scanPage,

            pgReference:
              columns.pgReference,

            pgColumnMapped:
              columns.mapped,

            candidateWorkTitles:
              passage.candidateWorkTitles,

            queryTerms:
              passage.queryTerms,

            matchedTerms:
              passage.matchedTerms,

            originalText:
              passage.originalText,

            contextText:
              passage.contextText,

            sourceUrl:
              passage.sourceUrl,

            pageImageUrl:
              passage.pageImageUrl,
          };
        },
      );


    return apiJson({
      query,

      plan: {
        authorName:
          plan.authorName,

        authorSource:
          plan.authorSource,

        pgVolumes:
          plan.pgVolumes,

        hasSpecificAuthor:
          plan.hasSpecificAuthor,

        hasSpecificWorks:
          plan.hasSpecificWorks,

        routingVerified:
          plan.routingVerified,

        authorVolumeVerified:
          plan.authorVolumeVerified,
      },

      greekSearch,

      resultCount:
        results.length,

      results,
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "research", failure: failureCategory(error) });


    return apiJson(
      {
        error: "General PG test failed.",
      },
      {
        status: 500,
      },
    );
  }
}
export const POST = secureResearchRoute(handleResearch, true);

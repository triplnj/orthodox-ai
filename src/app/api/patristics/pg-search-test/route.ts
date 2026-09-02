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
    const results =
      await searchPgPassages(
        query,
        5,
      );


    const enrichedResults =
      results.map(
        (result) => {
          const columns =
            mapPgScanPageToColumns(
              result.pgVolume,
              result.scanPage,
            );


          return {
            ...result,

            pgFirstColumn:
              columns.firstColumn,

            pgSecondColumn:
              columns.secondColumn,

            pgReference:
              columns.firstColumn &&
              columns.secondColumn
                ? `PG ${result.pgVolume}, cols. ${columns.firstColumn}–${columns.secondColumn}`
                : `PG ${result.pgVolume}`,
          };
        },
      );


    return NextResponse.json({
      query,

      count:
        enrichedResults.length,

      results:
        enrichedResults,
    });
  } catch (error) {
    console.error(
      "PG_SEARCH_TEST_ERROR:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PG search failed.",
      },
      {
        status: 500,
      },
    );
  }
}
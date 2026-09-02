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
          "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }


  let body: {
    query?: string;
  };


  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
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


    return NextResponse.json({
      query,

      count:
        results.length,

      results,
    });
  } catch (error) {
    console.error(
      "PG search test failed:",
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
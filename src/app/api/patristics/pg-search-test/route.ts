import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  searchPgPassages,
} from "@/lib/patristics/pg-passage-search";


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


    return NextResponse.json({
      query,

      count:
        results.length,

      results,
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
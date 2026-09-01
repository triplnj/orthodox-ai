import { NextRequest, NextResponse }
  from "next/server";

import { collectFromSource }
  from "@/lib/patristics/collect";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  try {
    const secret =
      request.headers.get(
        "x-patristics-secret",
      );
      console.log("HEADER EXISTS:", Boolean(secret));
console.log("HEADER LENGTH:", secret?.length);
console.log(
  "ENV EXISTS:",
  Boolean(process.env.PATRISTICS_SECRET),
);
console.log(
  "ENV LENGTH:",
  process.env.PATRISTICS_SECRET?.length,
);
console.log(
  "SECRETS MATCH:",
  secret === process.env.PATRISTICS_SECRET,
);  
    if (
      !process.env.PATRISTICS_SECRET ||
      secret !==
        process.env.PATRISTICS_SECRET
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      await request.json();

    const url =
      String(body.url ?? "");

    if (
      !url.startsWith("https://")
    ) {
      return NextResponse.json(
        {
          error:
            "Valid HTTPS URL required",
        },
        {
          status: 400,
        },
      );
    }

    const result =
      await collectFromSource(url);

    return NextResponse.json(
      result,
    );
  } catch (error) {

    console.error(
      "PATRISTICS_COLLECT_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Patristic collection failed",
      },
      {
        status: 500,
      },
    );
  }
}
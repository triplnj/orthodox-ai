import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { detectPatristicLanguage } from "@/lib/patristics/detect-language";
import { enqueuePatristicDiscovery } from "@/lib/patristics/enqueue-discovery";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const body = await req.json();

  const query =
    typeof body.query === "string"
      ? body.query.trim()
      : "";

  if (!query) {
    return NextResponse.json(
      { error: "Query is required." },
      { status: 400 },
    );
  }

  const language =
    detectPatristicLanguage(query);

  const job =
    await enqueuePatristicDiscovery({
      query,
      language,
    });

  return NextResponse.json({
    ok: true,
    job,
  });
}
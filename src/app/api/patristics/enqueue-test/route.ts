import { secureResearchRoute } from "@/lib/patristics/api-security";
import { NextResponse } from "next/server";
import { detectPatristicLanguage } from "@/lib/patristics/detect-language";
import { enqueuePatristicDiscovery } from "@/lib/patristics/enqueue-discovery";

async function handleResearch(req: Request) {

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
export const POST = secureResearchRoute(handleResearch, true);

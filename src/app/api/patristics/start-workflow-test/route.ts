import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { start } from "workflow/api";

import { patristicDiscoveryWorkflow } from "@/workflows/patristic-discovery";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const run = await start(
    patristicDiscoveryWorkflow,
    [],
  );

  return NextResponse.json({
    ok: true,
    runId: run.runId,
  });
}
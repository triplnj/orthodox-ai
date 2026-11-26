import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only verification of the isolated QA database. Never reveals DB URLs
 * or credentials. This feature route does not exist on production/main.
 */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaddleSandboxBranchGuard"
      WHERE "id" = 'br-red-waterfall-asdlxovu' LIMIT 1`;
    if (result.length !== 1) throw new Error("Wrong QA branch");
    return NextResponse.json({ ready: true, mode: "PADDLE_QA_DATABASE_VERIFIED" },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ready: false, error: "Paddle QA database is not verified." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

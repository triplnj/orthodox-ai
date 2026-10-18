import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recover } from "@/lib/billing/service";
import { billingFailure } from "@/lib/billing/http";

export async function POST(req: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid recovery request." }, { status: 400 }); }
    if (typeof body?.userId !== "string" || typeof body?.reason !== "string") {
      return NextResponse.json({ error: "User ID and recovery reason are required." }, { status: 400 });
    }
    await recover(body.userId, actor.id, body.reason);
    return NextResponse.json({ recovered: true });
  } catch (error) { return billingFailure(error); }
}

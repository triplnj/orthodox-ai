import { apiJson } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import { recover } from "@/lib/billing/service";
import { billingFailure } from "@/lib/billing/http";
import { parse, readJson, idSchema } from "@/lib/api/validation";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return apiJson({ error: "Unauthorized" }, { status: 401 });
    const body = parse(z.strictObject({ userId: idSchema, reason: z.string().trim().min(10).max(500) }), await readJson(req, 16384));
    if (typeof body?.userId !== "string" || typeof body?.reason !== "string") {
      return apiJson({ error: "User ID and recovery reason are required." }, { status: 400 });
    }
    await recover(body.userId, actor.id, body.reason);
    return apiJson({ recovered: true });
  } catch (error) { return billingFailure(error); }
}

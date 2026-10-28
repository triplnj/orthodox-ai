import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/api/response";

type FeedbackRow = { reason: string; feature: string; suggestion: string | null };
const reasons = new Set(["not_using", "price", "unclear_value", "answer_quality", "other"]);
const features = new Set(["patristics", "chat", "journal", "confession", "prayer", "other"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiJson({ error: "Sign in required." }, { status: 401 });
  try {
    const rows = await prisma.$queryRaw<FeedbackRow[]>`
      SELECT reason, feature, suggestion FROM "UserActivationFeedback" WHERE "userId" = ${user.id} LIMIT 1
    `;
    return apiJson({ feedback: rows[0] ?? null });
  } catch {
    return apiJson({ error: "Feedback unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiJson({ error: "Sign in required." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return apiJson({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return apiJson({ error: "JSON required." }, { status: 415 });
  }
  const raw = await request.text();
  if (raw.length > 2500) return apiJson({ error: "Submission too large." }, { status: 413 });
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return apiJson({ error: "Invalid JSON." }, { status: 400 }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return apiJson({ error: "Invalid feedback." }, { status: 400 });
  }
  const { reason, feature, suggestion } = data as Record<string, unknown>;
  if (typeof reason !== "string" || !reasons.has(reason) ||
      typeof feature !== "string" || !features.has(feature) ||
      (suggestion !== undefined && typeof suggestion !== "string") ||
      (typeof suggestion === "string" && suggestion.length > 500)) {
    return apiJson({ error: "Invalid feedback fields." }, { status: 400 });
  }
  try {
    await prisma.$executeRaw`
      INSERT INTO "UserActivationFeedback" ("userId", "reason", "feature", "suggestion")
      VALUES (${user.id}, ${reason}, ${feature}, ${typeof suggestion === "string" ? suggestion.trim() : ""})
      ON CONFLICT ("userId") DO NOTHING
    `;
    return apiJson({ saved: true });
  } catch {
    return apiJson({ error: "Could not save feedback." }, { status: 503 });
  }
}

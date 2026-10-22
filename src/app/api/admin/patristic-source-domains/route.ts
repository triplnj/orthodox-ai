import { apiJson } from "@/lib/api/response";
import { getSessionUser } from "@/lib/session";
import { AuthError, authFailure, authJson, text } from "@/lib/security/auth-input";
import { authLimit } from "@/lib/security/auth-limits";
import { manageSourceDomain } from "@/lib/security/source-admin";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) throw new AuthError("Unauthorized.", 401);
    if (!actor.emailVerified || !(process.env.PATRISTICS_SOURCE_ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).includes(actor.id)) throw new AuthError("Source-domain administrator authorization is required.", 403);
    await authLimit(req, "source-admin", actor.id);
    const body = await authJson(req);
    if (Object.keys(body).some(key => !["hostname", "enabled", "redirectHosts", "reason"].includes(key)) || (Array.isArray(body.redirectHosts) && body.redirectHosts.length > 10)) throw new AuthError("Invalid source-domain fields.");
    if (typeof body.enabled !== "boolean" || !Array.isArray(body.redirectHosts) || body.redirectHosts.some(h => typeof h !== "string")) throw new AuthError("Explicit enabled flag and redirect host list are required.");
    return apiJson(await manageSourceDomain({ hostname: text(body, "hostname", 253), enabled: body.enabled,
      redirectHosts: body.redirectHosts as string[], reason: text(body, "reason", 1000) }));
  } catch (error) { return authFailure(error); }
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { AuthError } from "./auth-input";
import { hostnameOnly, resolvePublicAddresses } from "./public-dns";
import { allowedSource } from "./source-policy";
import { pinnedSourceRequest } from "./source-transport";

async function administrator() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Unauthorized.", 401);
  const ids = (process.env.PATRISTICS_SOURCE_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (!user.emailVerified || !ids.includes(user.id)) throw new AuthError("Source-domain administrator authorization is required.", 403);
  return user;
}
export async function manageSourceDomain(input: { hostname: string; enabled: boolean; redirectHosts: string[]; reason: string }) {
  const actor = await administrator();
  const exactHost = (value: string) => { try { return hostnameOnly(value); } catch { throw new AuthError("An exact source hostname is required; URLs, ports, wildcards and IP literals are forbidden."); } };
  const hostname = exactHost(input.hostname);
  if (input.reason.trim().length < 20 || input.reason.length > 1000 || input.redirectHosts.length > 10) throw new AuthError("A 20–1000 character verification note and at most 10 redirect hosts are required.");
  const redirectHosts = [...new Set(input.redirectHosts.map(exactHost))];
  let addresses: string[] = [];
  try {
    if (input.enabled) {
      const signal = AbortSignal.timeout(10000);
      addresses = await resolvePublicAddresses(hostname, signal);
      // Probe only the exact hostname root over HTTPS, with no automatic redirects.
      const probe = await pinnedSourceRequest(new URL(`https://${hostname}/`), { method: "HEAD" }, signal, 65536);
      if (probe.status < 200 || probe.status >= 400) throw new AuthError("Source HTTPS verification failed.");
      if (probe.status >= 300) {
        const location = probe.headers.get("location");
        if (!location) throw new AuthError("Source redirect verification failed.");
        const target = new URL(location, `https://${hostname}/`);
        if (target.protocol !== "https:" || target.username || target.password || target.port ||
            (target.hostname !== hostname && !redirectHosts.includes(target.hostname))) throw new AuthError("Source root redirects outside the explicitly reviewed hosts.");
      }
      for (const target of redirectHosts) {
        if (!await allowedSource(target)) throw new AuthError("Redirect destinations must be separately approved first.");
        await resolvePublicAddresses(target, signal);
      }
    }
  } catch {
    await prisma.patristicSourceDomainAudit.create({ data: { hostname, actorId: actor.id, action: "VERIFICATION_FAILED",
      reason: input.reason, addresses, redirectHosts } });
    throw new AuthError("Source verification failed. No domain authorization was changed.");
  }
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`source-domain:${hostname}`}, 0))`;
    const current = await tx.user.findUnique({ where: { id: actor.id } });
    if (!current?.emailVerified || !(process.env.PATRISTICS_SOURCE_ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).includes(actor.id)) throw new AuthError("Source authorization has been revoked.", 403);
    const data = { enabled: input.enabled, redirectHosts, verifiedAt: new Date(), verifiedBy: actor.id, verificationNote: input.reason };
    await tx.patristicSourceDomain.upsert({ where: { hostname }, create: { hostname, ...data }, update: data });
    await tx.patristicSourceDomainAudit.create({ data: { hostname, actorId: actor.id, action: input.enabled ? "ENABLE" : "DISABLE",
      reason: input.reason, addresses, redirectHosts } });
  });
  return { hostname, enabled: input.enabled, redirectHosts };
}

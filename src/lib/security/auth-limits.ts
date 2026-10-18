import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { AuthError } from "./auth-input";

type Rule = { scope: string; subject: string; limit: number; seconds: number };
export function clientAddress(req: Request): string {
  const header = process.env.AUTH_TRUSTED_IP_HEADER?.toLowerCase();
  const value = header ? req.headers.get(header)?.trim() : undefined;
  // Only a deployment-overwritten single-IP header is supported, never a client
  // selected position from an arbitrary forwarding chain.
  return value && isIP(value) ? value : "unknown-ingress";
}
async function reserve(rules: Rule[]) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new AuthError("Authentication protection is not configured.", 503);
  const now = Date.now();
  const buckets = rules.map(rule => {
    const window = Math.floor(now / (rule.seconds * 1000));
    return { ...rule, key: createHmac("sha256", secret).update(JSON.stringify([rule.scope, rule.subject, window])).digest("hex"),
      expiresAt: new Date((window + 1) * rule.seconds * 1000) };
  }).sort((a, b) => a.key.localeCompare(b.key));
  await prisma.$transaction(async tx => {
    for (const bucket of buckets) {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`auth-rate:${bucket.key}`}, 0))`;
      const existing = await tx.authRateLimitBucket.findUnique({ where: { key: bucket.key } });
      if ((existing?.count ?? 0) >= bucket.limit) throw new AuthError("Too many requests. Please try again later.", 429,
        Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now) / 1000)));
    }
    for (const bucket of buckets) await tx.authRateLimitBucket.upsert({ where: { key: bucket.key },
      create: { key: bucket.key, count: 1, expiresAt: bucket.expiresAt }, update: { count: { increment: 1 } } });
  }, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 10000 });
}
export async function authLimit(req: Request, action: string, subject?: string, includeIp = true) {
  const ip = clientAddress(req);
  const registration = action === "register";
  const emailRequest = ["forgot", "resend"].includes(action);
  const seconds = registration || emailRequest ? 3600 : 900;
  const rules: Rule[] = includeIp ? [{ scope: `ip:${action}`, subject: ip, limit: registration ? 60 : emailRequest ? 120 : 300, seconds }] : [];
  if (subject) rules.push({ scope: `account:${action}`, subject, limit: registration ? 3 : emailRequest ? 20 : 10, seconds });
  await reserve(rules);
}
export async function emailLimit(email: string) {
  await reserve([{ scope: "email:cooldown", subject: email, limit: 1, seconds: 60 },
    { scope: "email:hour", subject: email, limit: 5, seconds: 3600 }]);
}

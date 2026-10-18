import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSessionRecord, setSessionCookie } from "@/lib/session";
import { sendEmailVerification, sendPasswordResetEmail } from "@/lib/email";
import { AuthError } from "./auth-input";

// A valid cost-12 bcrypt hash; used only for equal work on unknown accounts.
const DUMMY_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function authLock<T>(userId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`auth-user:${userId}`}, 0))`;
    return work(tx);
  }, { isolationLevel: "ReadCommitted", timeout: 20000, maxWait: 10000 });
}
export async function login(email: string, password: string) {
  const found = await prisma.user.findUnique({ where: { email } });
  if (!found) { await bcrypt.compare(password, DUMMY_HASH); throw new AuthError("Invalid email or password.", 401); }
  const result = await authLock(found.id, async tx => {
    const user = await tx.user.findUnique({ where: { id: found.id } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !valid) throw new AuthError("Invalid email or password.", 401);
    const session = await createSessionRecord(tx, user.id);
    return { user, session };
  });
  // If a reset commits here, its session deletion also invalidates this token.
  await setSessionCookie(result.session.token, result.session.expiresAt);
  const { id, name, plan } = result.user;
  return { user: { id, name, plan, email: result.user.email } };
}
export async function register(email: string, name: string, password: string) {
  // Hash for both cases; never return account state or create a registration session.
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`auth-register:${email}`}, 0))`;
    if (await tx.user.findUnique({ where: { email } })) return null;
    const user = await tx.user.create({ data: { email, name: name || null, passwordHash, plan: "FREE", subscriptionStatus: null } });
    return user.id;
  }, { isolationLevel: "ReadCommitted", timeout: 20000 });
}
export async function issueEmail(userId: string, kind: "verify" | "reset") {
  return authLock(userId, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || (kind === "verify" && user.emailVerified)) return null;
    const rawToken = randomBytes(32).toString("hex");
    const data = { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + (kind === "verify" ? 24 * 3600000 : 30 * 60000)) };
    if (kind === "verify") await tx.emailVerificationToken.create({ data });
    else await tx.passwordResetToken.create({ data });
    // Do not invalidate previous links on issuance or delivery failure.
    return { to: user.email, rawToken, kind };
  });
}
export async function deliverEmail(mail: Awaited<ReturnType<typeof issueEmail>>) {
  if (!mail) return;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  const url = new URL(mail.kind === "verify" ? "/verify-email" : "/reset-password", base);
  url.searchParams.set("token", mail.rawToken);
  if (mail.kind === "verify") await sendEmailVerification({ to: mail.to, verifyUrl: url.toString() });
  else await sendPasswordResetEmail({ to: mail.to, resetUrl: url.toString() });
}
export async function consumeToken(token: string, password?: string) {
  const reset = password !== undefined;
  const tokenHash = hashToken(token);
  const found = reset ? await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    : await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!found) throw new AuthError("Invalid or expired token.");
  const passwordHash = reset ? await bcrypt.hash(password!, 12) : undefined;
  await authLock(found.userId, async tx => {
    const now = new Date();
    const claim = { where: { id: found.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } };
    const claimed = reset ? await tx.passwordResetToken.updateMany(claim) : await tx.emailVerificationToken.updateMany(claim);
    if (claimed.count !== 1) throw new AuthError("Invalid or expired token.");
    await tx.user.update({ where: { id: found.userId }, data: reset ? { passwordHash } : { emailVerified: now } });
    const invalidate = { where: { userId: found.userId, usedAt: null }, data: { usedAt: now } };
    if (reset) await tx.passwordResetToken.updateMany(invalidate);
    else await tx.emailVerificationToken.updateMany(invalidate);
    if (reset) await tx.session.deleteMany({ where: { userId: found.userId } });
  });
}
export async function changePassword(userId: string, currentPassword: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  await authLock(userId, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new AuthError("Current password is incorrect.", 401);
    if (currentPassword === password) throw new AuthError("New password must be different from current password.");
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId } });
  });
}

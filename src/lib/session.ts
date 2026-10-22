import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const SESSION_COOKIE_NAME = "orthodoxai_session";
const SESSION_DURATION_DAYS = 30;

export async function createSession(userId: string) {
  const session = await createSessionRecord(prisma, userId);
  await setSessionCookie(session.token, session.expiresAt);
  return session.token;
}

export async function createSessionRecord(db: Pick<Prisma.TransactionClient, "session">, userId: string) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        token,
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

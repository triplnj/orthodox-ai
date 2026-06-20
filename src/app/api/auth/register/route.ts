import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import crypto from "crypto";
import { sendEmailVerification } from "@/lib/email";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        plan: "FREE",
        subscriptionStatus: null,
      },
    });

    await createSession(user.id);

    const rawToken = crypto.randomBytes(32).toString("hex");
const tokenHash = hashToken(rawToken);

const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24);

await prisma.emailVerificationToken.create({
  data: {
    userId: user.id,
    tokenHash,
    expiresAt,
  },
});

const verifyUrl = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}/verify-email?token=${rawToken}`;

console.log("EMAIL_VERIFICATION_LINK:", verifyUrl);

await sendEmailVerification({
  to: user.email,
  verifyUrl,
});

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
    });
  } catch (error) {
    console.error("REGISTER_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the account." },
      { status: 500 }
    );
  }
}
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to resend verification email." },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (dbUser.emailVerified) {
      return NextResponse.json({
        message: "Your email is already verified.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: {
        userId: dbUser.id,
        tokenHash,
        expiresAt,
      },
    });

    const verifyUrl = `${
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    }/verify-email?token=${rawToken}`;

   if (process.env.NODE_ENV !== "production") {
  console.log("EMAIL_VERIFICATION_LINK:", verifyUrl);
}

    await sendEmailVerification({
      to: dbUser.email,
      verifyUrl,
    });

    return NextResponse.json({
      message: "Verification email sent.",
    });
  } catch (error) {
    console.error("RESEND_VERIFICATION_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while sending verification email." },
      { status: 500 }
    );
  }
}
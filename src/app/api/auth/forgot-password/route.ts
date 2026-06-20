import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
      },
    });

    /*
      Important:
      We intentionally return the same visible response whether the email exists or not.
      This prevents account enumeration.
    */

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/reset-password?token=${rawToken}`;

      console.log("PASSWORD_RESET_LINK:", resetUrl);

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
      });
    }

    return NextResponse.json({
      message:
        "If an account exists for this email, password reset instructions will be sent.",
    });
  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while processing password reset." },
      { status: 500 }
    );
  }
}
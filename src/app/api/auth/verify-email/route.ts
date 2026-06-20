import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const token = String(body.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification token." },
        { status: 400 }
      );
    }

    if (verificationToken.usedAt) {
      return NextResponse.json(
        { error: "This verification token has already been used." },
        { status: 400 }
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This verification token has expired." },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          emailVerified: new Date(),
        },
      }),

      prisma.emailVerificationToken.update({
        where: {
          id: verificationToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while verifying email." },
      { status: 500 }
    );
  }
}
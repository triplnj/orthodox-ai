import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to change your password." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirmation are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { error: "Password cannot be changed for this account." },
        { status: 400 }
      );
    }

    const currentPasswordIsValid = await bcrypt.compare(
      currentPassword,
      dbUser.passwordHash
    );

    if (!currentPasswordIsValid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("SETTINGS_PASSWORD_UPDATE_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while changing your password." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to update your profile." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const name = String(body.name ?? "").trim();

    if (name.length > 80) {
      return NextResponse.json(
        { error: "Name must be 80 characters or fewer." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
    });
  } catch (error) {
    console.error("SETTINGS_PROFILE_UPDATE_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating your profile." },
      { status: 500 }
    );
  }
}
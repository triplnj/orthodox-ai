import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiFailure, parse, readJson, profileSchema } from "@/lib/api/validation";

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to update your profile." },
        { status: 401 }
      );
    }

    const body = parse(profileSchema, await readJson(req, 16384));

    const name = body.name;

    if (name.length > 80) {
      return apiJson(
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

    return apiJson({
      user: { ...updatedUser, plan: user.plan, subscriptionStatus: user.subscriptionStatus, billingAccessUntil: user.billingAccessUntil, reviewAccess: user.reviewAccess === true },
    });
  } catch (error) {
    diagnostic("operation_failed", { operation: "profile", failure: failureCategory(error) });

    return apiFailure(error);
  }
}

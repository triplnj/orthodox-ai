import { diagnostic, failureCategory } from "@/lib/diagnostics";
import { ApiError } from "@/lib/api/validation";
import { apiFailure } from "@/lib/api/validation";
import { queryInput } from "@/lib/api/validation";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { quotaSnapshot } from "@/lib/ai/operationLimits";

export async function GET(request?: Request) {
  try {
    if (request) { try { queryInput(request); } catch (error) { return apiFailure(error); } }
    const user = await getCurrentUser();

    if (!user) {
      return apiJson(
        { error: "You must be signed in to view your account." },
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
        name: true,
        emailVerified: true,
        plan: true,
        subscriptionStatus: true,
        billingAccessUntil: true,
        subscriptionId: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      return apiJson(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const chatCount = await prisma.chatMessage.count({
      where: {
        userId: user.id,
      },
    });

    const journalCount = await prisma.journalEntry.count({
      where: {
        userId: user.id,
      },
    });

    const quota = await quotaSnapshot(user.id, "chat", user);

    const todayUsage = quota.used;

    return apiJson({
      user: { ...dbUser, plan: user.plan, subscriptionStatus: user.subscriptionStatus, billingAccessUntil: user.billingAccessUntil, reviewAccess: user.reviewAccess === true },
      isPro: isProUser(user),
      stats: {
        quota, remainingQuestions: quota.remaining,
        chatCount,
        journalCount,
        todayUsage,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error);
    diagnostic("operation_failed", { operation: "account", failure: failureCategory(error) });

    return apiJson(
      { error: "Something went wrong while loading account data." },
      { status: 500 }
    );
  }
}

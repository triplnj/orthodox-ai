import { getSessionUser } from "@/lib/session";
import type { AppUser } from "@/lib/subscription";
import { refreshAccess } from "@/lib/billing/service";

export async function getCurrentUser(): Promise<AppUser | null> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return null;
  }
  // Admin access is explicitly bound to a verified account ID, never an email or a client role.
  const adminIds = (process.env.BLOG_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (sessionUser.emailVerified && adminIds.includes(sessionUser.id)) {
    return { id: sessionUser.id, email: sessionUser.email, name: sessionUser.name,
      plan: "PRO", subscriptionStatus: "active", adminAccess: true };
  }
  const user = await refreshAccess(sessionUser);

  // Preview-only Paddle Sandbox overlay. The independent provider evidence
  // check runs on access reads; no simulated event or stored cache alone
  // can authorize Pro, and production remains on existing providers.
  if (process.env.VERCEL_ENV === "preview" &&
      process.env.VERCEL_GIT_COMMIT_REF === "feature/paddle-transition-phase1-20261120" &&
      process.env.PADDLE_SANDBOX_GRANT_ACCESS === "enabled" &&
      user.emailVerified && !user.billingDeletionRequestedAt) {
    const { getPaddleSandboxPreviewAccess } =
      await import("@/lib/billing/paddle-preview-entitlement");
    const until = await getPaddleSandboxPreviewAccess(user.id);
    if (until) {
      return {
        id: user.id, email: user.email, name: user.name, plan: "PRO" as const,
        subscriptionStatus: "active", billingAccessUntil: until,
        reviewAccess: user.reviewAccess === true,
      };
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    billingAccessUntil: user.billingAccessUntil,
    reviewAccess: user.reviewAccess === true,
  };
}

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

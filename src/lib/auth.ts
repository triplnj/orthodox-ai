import { getSessionUser } from "@/lib/session";
import type { AppUser } from "@/lib/subscription";
import { refreshAccess } from "@/lib/billing/service";

export async function getCurrentUser(): Promise<AppUser | null> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return null;
  }
  const user = await refreshAccess(sessionUser);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    billingAccessUntil: user.billingAccessUntil,
  };
}

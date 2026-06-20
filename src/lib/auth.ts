import { getSessionUser } from "@/lib/session";
import type { AppUser } from "@/lib/subscription";

export async function getCurrentUser(): Promise<AppUser | null> {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
  };
}
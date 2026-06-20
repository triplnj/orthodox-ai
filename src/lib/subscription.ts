export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  plan: "FREE" | "PRO";
  subscriptionStatus?: string | null;
};

export function isProUser(user: AppUser) {
  return user.plan === "PRO" && user.subscriptionStatus === "active";
}
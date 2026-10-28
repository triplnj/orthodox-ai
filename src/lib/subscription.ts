export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  plan: "FREE" | "PRO";
  subscriptionStatus?: string | null;
  billingAccessUntil?: Date | string | null;
  reviewAccess?: boolean;
  adminAccess?: boolean;
};

export function isProUser(user: AppUser) {
  return user.adminAccess === true || (user.plan === "PRO" && user.subscriptionStatus === "active" &&
    (user.reviewAccess === true || Boolean(user.billingAccessUntil && new Date(user.billingAccessUntil).getTime() > Date.now())));
}

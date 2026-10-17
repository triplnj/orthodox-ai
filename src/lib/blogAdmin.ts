import { getSessionUser } from "@/lib/session";

export async function getBlogAdminUser() {
  // Read the current database user on every request/action. Never authorize
  // from a submitted email, an email allowlist, or a cached session role.
  const currentUser = await getSessionUser();

  if (!currentUser?.emailVerified) {
    return null;
  }

  const adminUserIds = (process.env.BLOG_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminUserIds.includes(currentUser.id)) {
    return null;
  }

  return { id: currentUser.id, email: currentUser.email };
}

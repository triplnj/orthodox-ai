import { getCurrentUser } from "@/lib/auth";

export async function getBlogAdminUser() {
  const currentUser = await getCurrentUser();

  if (!currentUser?.email) {
    return null;
  }

  const adminEmails = (process.env.BLOG_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(currentUser.email.toLowerCase())) {
    return null;
  }

  return currentUser;
}
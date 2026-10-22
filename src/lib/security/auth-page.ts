import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export async function guardAuthenticationPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  if ((await cookies()).get("orthodoxai_session")?.value) redirect("/api/auth/clear-invalid-session");
}

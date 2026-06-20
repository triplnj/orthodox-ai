import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { NavbarClient } from "@/components/layout/NavbarClient";

export async function Navbar() {
  const user = await getCurrentUser();
  const isPro = user ? isProUser(user) : false;

  return <NavbarClient user={user} isPro={isPro} />;
}
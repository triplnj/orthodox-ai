import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
export const dynamic = "force-dynamic";
export default async function ProSuccessPage() {
  // A return URL is not evidence of payment. Even verified Pro access does not
  // prove that this particular checkout succeeded.
  const user = await getCurrentUser();
  const active = Boolean(user && isProUser(user));
  return <main className="mx-auto max-w-3xl px-6 py-16"><section className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
    <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Subscription status</p>
    <h1 className="mt-3 text-3xl font-bold text-gray-950">{active ? "Your Pro access is active." : "Check your subscription status."}</h1>
    <p className="mt-5 text-base leading-7 text-gray-700">{active ? "Your account currently has Pro access. View your account for subscription details."
      : "Payment has not been confirmed on this page. If you just completed checkout, allow time for confirmation, then check your account. Do not start another checkout while the outcome is uncertain."}</p>
    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href={user ? "/account" : "/login?next=/account"} className="rounded-lg bg-gray-950 px-6 py-3 text-sm font-semibold text-white">{user ? "View account status" : "Sign in to check status"}</Link><Link href="/today" className="rounded-lg border border-gray-300 px-6 py-3 text-sm">Go to Today</Link></div>
  </section></main>;
}

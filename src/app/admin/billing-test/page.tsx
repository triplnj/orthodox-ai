import { getSessionUser } from "@/lib/session";
import { TestCheckoutButton } from "@/components/billing/TestCheckoutButton";
import { prisma } from "@/lib/prisma";

export default async function BillingTestPage() {
  const user = await getSessionUser();
  const allowed = [process.env.BLOG_ADMIN_USER_IDS, process.env.BILLING_TEST_USER_IDS]
    .flatMap(value => (value ?? "").split(",").map(item => item.trim()).filter(Boolean));
  if (!user?.emailVerified || !allowed.includes(user.id)) {
    return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-2xl font-bold">Not available</h1><p>Billing tests are restricted to authorized accounts.</p></main>;
  }
  const attempts = await prisma.billingCheckoutAttempt.findMany({
    where: { userId: user.id, provider: "LEMONSQUEEZY_TEST" },
    orderBy: { createdAt: "desc" }, take: 6,
    select: { status: true, createdAt: true, expiresAt: true },
  });
  return <main className="mx-auto max-w-3xl px-6 py-12 text-gray-950">
    <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Administrator / billing QA</p>
    <h1 className="mt-3 text-3xl font-bold">Lemon Squeezy — TEST Mode</h1>
    <p className="mt-4 leading-7">This separate test checkout uses test-only credentials and a test variant.
      It never grants or changes a live OrthodoxAI Pro subscription. Do not use real card details.</p>
    <div className="mt-7"><TestCheckoutButton /></div>
    <p className="mt-4 text-sm text-gray-600">Test Visa: 4242 4242 4242 4242; any future expiry and any three-digit CVC. The test webhook must be configured separately in Lemon Squeezy.</p>
    <h2 className="mt-10 text-xl font-semibold">Recent TEST attempts</h2>
    {attempts.length ? <ul className="mt-3 space-y-2">{attempts.map((a, i) =>
      <li key={i} className="rounded-lg border p-3 text-sm">{a.createdAt.toISOString()} — {a.status}
        {a.expiresAt ? ` (link expires ${a.expiresAt.toISOString()})` : ""}</li>)}</ul>
      : <p className="mt-3 text-gray-600">No test checkouts recorded yet.</p>}
    <p className="mt-6 text-xs leading-5 text-gray-600">Live billing remains separate at /pro and uses only verified live Lemon Squeezy credentials.</p>
  </main>;
}

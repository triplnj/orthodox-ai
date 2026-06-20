import Link from "next/link";
import { ProStatusCard } from "@/components/pro/ProStatusCard";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { productCopy } from "@/lib/productCopy";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { CustomerPortalButton } from "@/components/billing/CustomerPortalButton";

const proTools = [
  {
    title: "Unlimited OrthodoxAI Chat",
    description:
      "Ask deeper questions about prayer, fasting, Scripture, worship, saints, doctrine, and practical Orthodox Christian life.",
    href: "/chat",
  },
  {
    title: "Personal Prayer Plan",
    description:
      "Create a realistic prayer rhythm based on your current level, available time, and spiritual focus.",
    href: "/prayers",
  },
  {
    title: "Scripture Reading Plan",
    description:
      "Receive a structured Scripture reading rhythm with Orthodox-oriented reflection prompts.",
    href: "/scripture",
  },
  {
    title: "Spiritual Journal",
    description:
      "Organize reflections, prayer notes, struggles, and questions you may want to bring to your priest.",
    href: "/journal",
  },
  {
    title: "Fasting Guidance",
    description:
      "Understand the spiritual purpose of fasting and receive beginner-friendly explanations.",
    href: "/fasting",
  },
  {
    title: "Daily Orthodox Rhythm",
    description:
      "Use the Today page to start with prayer, reflection, Scripture, and a practical spiritual focus.",
    href: "/today",
  },
];

export default async function ProPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-gray-950">
            Sign in required
          </h1>

          <p className="mt-4 text-sm leading-6 text-gray-600">
            You must be signed in to manage your OrthodoxAI plan.
          </p>
        </section>
      </main>
    );
  }

  const isPro = isProUser(user);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            OrthodoxAI Pro
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950 sm:text-5xl">
            A deeper daily OrthodoxAI experience.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
            Pro is designed for believers who want OrthodoxAI to become part of
            their daily rhythm: prayer, Scripture, fasting, reflection, and
            steady spiritual discipline.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            
            {isPro ? (
                <>
            <Link
             href="/today"
                 className="rounded-lg bg-gray-950 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
            >
                Go to Today
            </Link>

                <CustomerPortalButton />
            </>
                ) : (
            <CheckoutButton>Upgrade to Pro</CheckoutButton>
            )}
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              Back to pricing
            </Link>
          </div>

          {!isPro && (
            <p className="mt-5 text-xs leading-5 text-gray-500">
             You will be redirected to Stripe Checkout to complete your subscription.
            </p>
          )}
        </div>

        <ProStatusCard user={user} />
      </section>

      <section className="mt-14 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-950">
          {productCopy.proPlan.name} includes
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          {productCopy.proPlan.description}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {productCopy.proPlan.features.map((feature) => (
            <div
              key={feature}
              className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700"
            >
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-gray-950">
          Pro tools
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {proTools.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-950"
            >
              <h3 className="font-semibold text-gray-950">{tool.title}</h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-10 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { CustomerPortalButton } from "@/components/billing/CustomerPortalButton";
import { productCopy } from "@/lib/productCopy";

type DashboardData = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    emailVerified: string | null;
    onboardingCompleted: boolean;
    spiritualGoal: string | null;
    experienceLevel: string | null;
    dailyTime: string | null;
    plan: "FREE" | "PRO";
    subscriptionStatus?: string | null;
  };
  isPro: boolean;
  stats: {
    chatCount: number;
    journalCount: number;
    todayChatUsage: number;
    freeDailyChatLimit: number;
    remainingFreeQuestions: number | null;
  };
  dailyRhythm: {
  title: string;
  subtitle: string;
  time: string;
  level: string;
  goal: string;
  steps: {
    title: string;
    description: string;
  }[];
  journalQuestion: string;
};
  recentMessages: {
    id: string;
    role: string;
    content: string;
    category: string | null;
    createdAt: string;
  }[];
  recentJournalEntries: {
    id: string;
    title: string | null;
    content: string;
    aiSummary: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
};

const quickActions = [
  {
    title: "Ask OrthodoxAI",
    description: "Ask a question about prayer, fasting, Scripture, or Orthodox life.",
    href: "/chat",
  },
  {
    title: "Today",
    description: "Start with a daily rhythm of prayer, reflection, and Scripture.",
    href: "/today",
  },
  {
    title: "Prayer Plan",
    description: "Create a realistic Orthodox prayer rhythm.",
    href: "/prayers",
  },
  {
  title: "Confession Preparation",
    description:
    "Prepare for confession with self-examination questions and pastoral boundaries.",
    href: "/confession",
},
  {
    title: "Scripture Plan",
    description: "Build a steady Bible reading rhythm.",
    href: "/scripture",
  },
  {
    title: "Fasting Guidance",
    description: "Get careful, non-extreme fasting support.",
    href: "/fasting",
  },
  {
    title: "Spiritual Journal",
    description: "Write and organize your reflections.",
    href: "/journal",
  },
];

function DashboardContent(){
    const searchParams = useSearchParams();
    const verifySent = searchParams.get("verify") === "sent";
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard");
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not load dashboard.");
          return;
        }

        setDashboard(data);
      } catch {
        setError("Network error while loading dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">Dashboard error</h1>

          <p className="mt-3 text-sm text-red-700">{error}</p>

          <div className="mt-6 flex gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-950"
            >
              Create account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { user, isPro, stats, dailyRhythm, recentMessages, recentJournalEntries } = dashboard;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
        {verifySent && (
  <section className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6">
    <h2 className="text-lg font-semibold text-green-950">
      Verification email sent
    </h2>

    <p className="mt-2 text-sm leading-6 text-green-800">
      We sent a verification link to your email address. Open your inbox and
      click the verification link to confirm your OrthodoxAI account.
    </p>

   
  </section>
)}
{!user.emailVerified && (
  <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <h2 className="text-lg font-semibold text-amber-950">
      Verify your email address
    </h2>

    <p className="mt-2 text-sm leading-6 text-amber-900">
      Your email address is not verified yet. You can use basic OrthodoxAI
      features, but email verification is required before upgrading to Pro.
    </p>

    <Link
      href="/settings"
      className="mt-4 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white"
    >
      Verify email
    </Link>
  </section>
)}
      <section className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
            Welcome {user.name ? `, ${user.name}` : ""}.
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
            Use your dashboard to continue your daily OrthodoxAI rhythm: prayer,
            Scripture, fasting, reflection, journaling, and conversation history.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/today"
              className="rounded-lg bg-gray-950 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
            >
              Start today
            </Link>

            <Link
              href="/chat"
              className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              Ask OrthodoxAI
            </Link>

            <Link
              href="/account"
              className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              Account
            </Link>
          </div>
        </div>

        <div
          className={
            isPro
              ? "rounded-2xl border border-green-200 bg-green-50 p-6"
              : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          }
        >
          <p
            className={
              isPro
                ? "text-sm font-semibold uppercase tracking-wide text-green-700"
                : "text-sm font-semibold uppercase tracking-wide text-gray-500"
            }
          >
            Current plan
          </p>

          <h2
            className={
              isPro
                ? "mt-3 text-3xl font-bold text-green-950"
                : "mt-3 text-3xl font-bold text-gray-950"
            }
          >
            {isPro ? "OrthodoxAI Pro" : "Free"}
          </h2>

          <p
            className={
              isPro
                ? "mt-3 text-sm leading-6 text-green-900"
                : "mt-3 text-sm leading-6 text-gray-600"
            }
          >
            {isPro
              ? "Your Pro access is active. You have unlimited questions and access to Pro tools."
              : `You have ${stats.remainingFreeQuestions} Free questions remaining today.`}
          </p>

          {!isPro && (
          <p className="mt-2 text-sm text-gray-500">
            Pro plan: $7.99/month · Early access pricing · Cancel anytime.
          </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
           {isPro ? (
  <Link
            href="/settings"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
          >
            Manage account
          </Link>
        ) : (
          <CheckoutButton />
        )}

            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Chat messages
          </p>

          <p className="mt-3 text-3xl font-bold text-gray-950">
            {stats.chatCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Journal entries
          </p>

          <p className="mt-3 text-3xl font-bold text-gray-950">
            {stats.journalCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Chat usage today
          </p>

          <p className="mt-3 text-3xl font-bold text-gray-950">
            {stats.todayChatUsage}
            {!isPro && (
              <span className="text-base font-medium text-gray-500">
                /{stats.freeDailyChatLimit}
              </span>
            )}
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Daily rhythm
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-gray-950">
        {dailyRhythm.title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-gray-600">
        {dailyRhythm.subtitle}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
      <p>
        <span className="font-semibold text-gray-950">Time:</span>{" "}
        {dailyRhythm.time}
      </p>

      <p className="mt-1">
        <span className="font-semibold text-gray-950">Level:</span>{" "}
        {dailyRhythm.level}
      </p>
    </div>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    {dailyRhythm.steps.map((step, index) => (
      <article
        key={`${step.title}-${index}`}
        className="rounded-xl border border-gray-100 bg-gray-50 p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Step {index + 1}
        </p>

        <h3 className="mt-2 font-semibold text-gray-950">
          {step.title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          {step.description}
        </p>
      </article>
    ))}
  </div>

  <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      Journal question
    </p>

    <p className="mt-2 text-sm font-medium leading-6 text-gray-950">
      {dailyRhythm.journalQuestion}
    </p>

    <Link
      href="/journal"
      className="mt-4 inline-block rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:border-gray-950"
    >
      Open journal
    </Link>
  </div>
</section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Your rhythm
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-gray-950">
        Personal setup
      </h2>

      <p className="mt-3 text-sm leading-6 text-gray-600">
        These preferences help OrthodoxAI shape your prayer, Scripture,
        fasting, and reflection tools.
      </p>
    </div>

    <Link
      href="/onboarding"
      className="rounded-lg border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
    >
      Update setup
    </Link>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Goal
      </p>

      <p className="mt-2 text-sm font-medium text-gray-950">
        {user.spiritualGoal ?? "Not set"}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Experience
      </p>

      <p className="mt-2 text-sm font-medium text-gray-950">
        {user.experienceLevel ?? "Not set"}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Daily time
      </p>

      <p className="mt-2 text-sm font-medium text-gray-950">
        {user.dailyTime ?? "Not set"}
      </p>
    </div>
  </div>
</section>

      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white-950">
              Quick actions
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Continue with the main OrthodoxAI tools.
            </p>
          </div>

          <Link
            href="/pro"
            className="text-sm font-semibold text-white-950 hover:underline"
          >
            View Pro tools
          </Link>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-950"
            >
              <h3 className="font-semibold text-gray-950">{action.title}</h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white-950">
              Recent conversations
            </h2>

            <Link
              href="/history"
              className="text-sm font-semibold text-white-950 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {recentMessages.length === 0 && (
              <div className="rounded-2xl border border-white-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
                No conversations yet.
              </div>
            )}

            {recentMessages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {message.role} · {message.category ?? "general"}
                </p>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {message.content}
                </p>

                <p className="mt-3 text-xs text-white-500">
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white-950">
              Recent journal entries
            </h2>

            <Link
              href="/journal"
              className="text-sm font-semibold text-white-950 hover:underline"
            >
              Open journal
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {recentJournalEntries.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
                No journal entries yet.
              </div>
            )}

            {recentJournalEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-gray-950">
                  {entry.title ?? "Untitled reflection"}
                </h3>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {entry.content}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <p className="mt-10 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
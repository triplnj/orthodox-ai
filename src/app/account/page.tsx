"use client";
import { FULL_ACCESS_DAILY_CHAT_LIMIT } from "@/lib/features";


import { useEffect, useState } from "react";
import { ReadError } from "@/components/layout/ReadError";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { CustomerPortalButton } from "@/components/billing/CustomerPortalButton";
import { productCopy } from "@/lib/productCopy";

type AccountData = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: "FREE" | "PRO";
    adminAccess?: boolean;
    subscriptionStatus: string | null;
    subscriptionId: string | null;
    stripeCustomerId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  isPro: boolean;
  stats: {
    chatCount: number;
    journalCount: number;
    todayUsage: number;
    remainingQuestions?: number;
  };
};

export default function AccountPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

 useEffect(() => {
  async function loadAccount() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account");
      const data = await response.json();

      if (!response.ok) {
        setAuthenticationRequired(response.status === 401);
        setError(data.error ?? "Could not load account.");
        return;
      }

      setAccount(data);
    } catch {
      setError("Network error while loading account.");
    } finally {
      setIsLoading(false);
    }
  }

  loadAccount();
}, [loadAttempt]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p role="status" className="text-sm text-gray-600">Loading account...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">Account error</h1>

          <ReadError message={error} authenticationRequired={authenticationRequired} retry={() => setLoadAttempt(value => value + 1)} />

          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!account) {
    return null;
  }

  const { user, isPro, stats } = account;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Account
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Manage your OrthodoxAI account.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          View your current plan, billing status, usage, and access to Pro tools.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
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
            {user.adminAccess ? "Admin" : isPro ? "OrthodoxAI Pro" : "Free"}
          </h2>

          <p
            className={
              isPro
                ? "mt-3 text-sm leading-6 text-green-900"
                : "mt-3 text-sm leading-6 text-gray-600"
            }
          >
            {user.adminAccess
              ? "Administrator access is active. You can use all OrthodoxAI tools without a subscription."
              : isPro
              ? `Your Pro access is active. You can use ${FULL_ACCESS_DAILY_CHAT_LIMIT} questions per day, journal tools, prayer plans, Scripture plans, and extended history.`
              : "You are currently using the Free plan. You can ask 5 AI questions per day and access basic OrthodoxAI tools."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {user.adminAccess ? null : isPro ? <CustomerPortalButton /> : <CheckoutButton />}

            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              View pricing
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            Account details
          </h2>

          <div className="mt-5 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-950">
                {user.name ?? "Not set"}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-950">{user.email}</span>
            </div>

            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Plan</span>
              <span className="font-medium text-gray-950">{user.adminAccess ? "Admin" : user.plan}</span>
            </div>

            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Subscription status</span>
              <span className="font-medium text-gray-950">
                {user.adminAccess ? "Administrator" : user.subscriptionStatus ?? "none"}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Legacy Stripe connection</span>
              <span className="font-medium text-gray-950">
                {user.stripeCustomerId ? "connected" : "not connected"}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-950">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
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
            Usage today
          </p>

          <p className="mt-3 text-3xl font-bold text-gray-950">
            {stats.todayUsage}
          </p>
          {typeof stats.remainingQuestions === "number" && <p className="mt-2 text-sm text-gray-600">Questions remaining today: {stats.remainingQuestions}</p>}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-950">
          {user.adminAccess ? "Admin tools" : "Pro tools"}
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/chat"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            OrthodoxAI Chat
          </Link>

          <Link
            href="/prayers"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            Personal Prayer Plan
          </Link>

          <Link
            href="/scripture"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            Scripture Reading Plan
          </Link>

          <Link
            href="/journal"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            Spiritual Journal
          </Link>

          <Link
            href="/history"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            Conversation History
          </Link>

          <Link
            href="/today"
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-800 hover:border-gray-950"
          >
            Today
          </Link>
        </div>
      </section>

      <p className="mt-8 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setError("Missing verification token.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not verify email.");
          return;
        }

        setMessage(data.message ?? "Email verified successfully.");
      } catch {
        setError("Network error while verifying email.");
      } finally {
        setIsLoading(false);
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Email verification
        </p>

        <h1 className="mt-3 text-3xl font-bold text-gray-950">
          Verify your email
        </h1>

        {isLoading && (
          <p className="mt-5 text-sm leading-6 text-gray-600">
            Verifying your email address...
          </p>
        )}

        {message && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/settings"
            className="rounded-lg border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
          >
            Account settings
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16">
          <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-600">Loading verification...</p>
          </section>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
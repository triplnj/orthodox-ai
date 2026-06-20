"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not reset password.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccessMessage(data.message ?? "Password has been reset.");
    } catch {
      setError("Network error while resetting password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">
            Missing reset token
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-700">
            This password reset link is invalid. Request a new password reset
            link.
          </p>

          <Link
            href="/forgot-password"
            className="mt-6 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Request new link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Password reset
        </p>

        <h1 className="mt-3 text-3xl font-bold text-gray-950">
          Set a new password
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          Enter a new password for your OrthodoxAI account. Use at least 8
          characters.
        </p>

        {successMessage && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <p>{successMessage}</p>

            <Link
              href="/login"
              className="mt-3 inline-block rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!successMessage && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                New password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Confirm new password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-gray-600">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-gray-950">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16">
          <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-600">Loading reset form...</p>
          </section>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
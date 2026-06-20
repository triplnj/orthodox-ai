"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }

    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get("next") ?? "/dashboard";

    router.push(nextUrl);
    router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sign in
        </p>

        <h1 className="mt-3 text-3xl font-bold text-gray-950">
          Welcome back
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          Sign in to continue using OrthodoxAI.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
  <div>
    <label className="text-sm font-medium text-gray-700">
      Email
    </label>

    <input
      type="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
      placeholder=""
      required
    />
  </div>

  <div>
    <label className="text-sm font-medium text-gray-700">
      Password
    </label>

    <input
      type="password"
      value={password}
      onChange={(event) => setPassword(event.target.value)}
      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
      placeholder=""
      required
    />
  </div>

  <div className="text-right">
    <Link
      href="/forgot-password"
      className="text-sm font-semibold text-gray-950 hover:underline"
    >
      Forgot password?
    </Link>
  </div>

  <button
    type="submit"
    disabled={isSubmitting}
    className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
  >
    {isSubmitting ? "Signing in..." : "Sign in"}
  </button>
</form>
        <p className="mt-6 text-sm text-gray-600">
          Do not have an account?{" "}
          <Link href="/register" className="font-semibold text-gray-950">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
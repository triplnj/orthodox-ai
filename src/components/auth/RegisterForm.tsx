"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export default function RegisterForm() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not create account.");
        return;
      }

    setPassword("");
    setMessage(data.message);
    } catch {
      setError("Network error while creating account.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Create account
        </p>

        <h1 className="mt-3 text-3xl font-bold text-gray-950">
          Start using OrthodoxAI
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          Create a free account to use OrthodoxAI, save usage, and prepare for
          future Pro features.
        </p>

        {error && (
          <div id="form-error-1" role="alert" tabIndex={-1} className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && <div role="status" className="mt-5 rounded-xl bg-gray-50 p-4 text-sm">{message} <Link href="/login?next=/onboarding" className="font-semibold underline">Sign in</Link></div>}
        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label htmlFor="register-name" className="text-sm font-medium text-gray-700">Name</label>

            <input aria-describedby={error ? "form-error-1" : undefined}
              id="register-name"
              autoComplete="name"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
              placeholder=""
            />
          </div>

          <div>
            <label htmlFor="register-email" className="text-sm font-medium text-gray-700">Email</label>

            <input aria-describedby={error ? "form-error-1" : undefined}
              id="register-email"
              autoComplete="email"
              type="email"  maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
              placeholder=""
              required
            />
          </div>

          <div>
            <label htmlFor="register-password" className="text-sm font-medium text-gray-700">
              Password
            </label>

            <input aria-describedby={error ? "form-error-1" : undefined}
              id="register-password"
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
              placeholder=""
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-gray-950">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

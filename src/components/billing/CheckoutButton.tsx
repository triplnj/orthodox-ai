"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type CheckoutButtonProps = {
  children?: React.ReactNode;
};

export function CheckoutButton({
  children = "Upgrade to Pro",
}: CheckoutButtonProps) {
  const pending = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(false);

  async function handleCheckout() {
    if (pending.current) return;
    pending.current = true;
    setIsLoading(true);
    setError(null);
    setEmailVerificationRequired(false);

    try {
      const response = await fetch("/api/lemonsqueezy/create-checkout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not start Checkout.");

        if (data.emailVerificationRequired) {
          setEmailVerificationRequired(true);
        }

        return;
      }

         if (!data.url) {
        setError("Checkout URL was not returned.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not confirm checkout. Check your account status before trying again; do not start another checkout while the outcome is uncertain.");
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading}
        className="rounded-lg bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Opening Checkout..." : children}
      </button>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>

          {emailVerificationRequired && (
            <Link
              href="/settings"
              className="mt-3 inline-block rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Verify email in Settings
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
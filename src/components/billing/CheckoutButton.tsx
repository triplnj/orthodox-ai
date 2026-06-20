"use client";

import { useState } from "react";
import Link from "next/link";

type CheckoutButtonProps = {
  children?: React.ReactNode;
};

export function CheckoutButton({
  children = "Upgrade to Pro",
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(false);

  async function handleCheckout() {
    setIsLoading(true);
    setError(null);
    setEmailVerificationRequired(false);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
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

      window.location.href = data.url;
    } catch {
      setError("Network error while starting Checkout.");
    } finally {
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
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
"use client";

import { useRef, useState } from "react";

export function CustomerPortalButton() {
  const pending = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePortal() {
    if (pending.current) return;
    pending.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lemonsqueezy/customer-portal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }

      if (!data.url) {
        setError("Billing portal URL was not returned.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error while opening billing portal.");
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePortal}
        disabled={isLoading}
        className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:border-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Opening billing portal..." : "Manage subscription"}
      </button>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
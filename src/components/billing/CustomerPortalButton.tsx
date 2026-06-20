"use client";

import { useState } from "react";

export function CustomerPortalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePortal() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error while opening billing portal.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePortal}
        disabled={isLoading}
        className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-800 hover:border-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Opening billing portal..." : "Manage billing"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
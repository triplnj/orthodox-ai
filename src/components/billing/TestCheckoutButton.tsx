"use client";
import { useRef, useState } from "react";

export function TestCheckoutButton() {
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  async function beginTest() {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/lemonsqueezy/test-checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || data.mode !== "TEST" || !data.url) {
        throw new Error(data.error ?? "The test checkout could not be opened.");
      }
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start test checkout.");
    } finally {
      pending.current = false;
      setWorking(false);
    }
  }
  return <div>
    <button type="button" disabled={working} onClick={beginTest}
      className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
      {working ? "Opening TEST checkout..." : "Start TEST checkout"}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}

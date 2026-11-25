"use client";

import { useState } from "react";

export function PaddleQaActivateButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reconcile() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/paddle/qa-payment-check", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json() as {
        activated?: boolean; mode?: string; error?: string;
      };
      if (!response.ok || payload.activated !== true ||
          payload.mode !== "QA_SANDBOX_ACCESS_RECONCILED") {
        throw new Error(payload.error ?? "Could not reconcile Sandbox Pro access.");
      }
      setMessage("Sandbox access record created. Refresh the dashboard and check the Pro plan status.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QA activation could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Existing Paddle test purchase</h2>
      <p className="mt-2 text-sm text-gray-600">
        This creates a QA access record only after the server checks the
        completed Sandbox transaction and your account ownership again.
        No new payment will be made.
      </p>
      <button onClick={reconcile} type="button" disabled={busy}
        className="mt-4 rounded-lg bg-gray-950 px-5 py-3 text-white disabled:opacity-50">
        {busy ? "Verifying with Paddle…" : "Verify and activate Sandbox Pro"}
      </button>
      {message && <p role="status" className="mt-4 text-sm text-gray-700">{message}</p>}
    </section>
  );
}

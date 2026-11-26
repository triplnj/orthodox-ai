"use client";

import { useRef, useState } from "react";
import Script from "next/script";

type PaddleCheckout = {
  Environment: { set: (environment: "sandbox") => void };
  Initialize: (settings: { token: string }) => void;
  Checkout: { open: (options: {
    items: Array<{ priceId: string; quantity: number }>;
    customData: Record<string, string | number>;
    settings?: { displayMode: "overlay" };
  }) => void };
};
type CheckoutBindingResponse = {
  mode?: string;
  paymentEnabled?: boolean;
  priceId?: string;
  customData?: Record<string, string | number>;
  error?: string;
};

export function PaddleSandboxCheckout({ token }: { token: string }) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const initialized = useRef(false);

  async function openCheckout() {
    if (!loaded || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/paddle/checkout-binding", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json() as CheckoutBindingResponse;
      if (!response.ok || payload.mode !== "SANDBOX_CHECKOUT_READY" ||
          payload.paymentEnabled !== true || !payload.customData ||
          typeof payload.priceId !== "string" || !/^pri_[a-z0-9]{26}$/.test(payload.priceId)) {
        throw new Error(payload.error ?? "Sandbox checkout was not authorized.");
      }
      const paddle = (window as Window & { Paddle?: PaddleCheckout }).Paddle;
      if (!paddle || !token.startsWith("test_")) {
        throw new Error("Paddle Sandbox client is unavailable.");
      }
      if (!initialized.current) {
        paddle.Environment.set("sandbox");
        paddle.Initialize({ token });
        initialized.current = true;
      }
      paddle.Checkout.open({
        items: [{ priceId: payload.priceId, quantity: 1 }],
        customData: payload.customData,
        settings: { displayMode: "overlay" },
      });
      setMessage("Sandbox checkout opened. Only Paddle test cards may be used. A checkout success screen does not prove that Pro access was granted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open Sandbox checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive" onReady={() => setLoaded(true)}
        onError={() => setMessage("Paddle.js script failed to load.")} />
      <h2 className="text-xl font-semibold">OrthodoxAI Pro — Sandbox</h2>
      <p className="mt-2 text-gray-700">$7.99 USD per month (test environment only).</p>
      <p className="mt-2 text-sm text-gray-600">
        A verified Preview account is required. This checkout uses the Sandbox
        product only; production billing and the existing Upgrade button are unchanged.
        Pro activation remains disabled until we verify this entire flow.
      </p>
      <button type="button" disabled={!loaded || busy} onClick={openCheckout}
        className="mt-5 rounded-lg bg-gray-950 px-5 py-3 text-white disabled:opacity-50">
        {busy ? "Checking account…" : "Open Paddle Sandbox checkout"}
      </button>
      {message && <p role="status" className="mt-4 text-sm text-gray-700">{message}</p>}
    </section>
  );
}

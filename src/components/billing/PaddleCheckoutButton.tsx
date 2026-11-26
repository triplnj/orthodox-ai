"use client";

import { useRef, useState } from "react";

type PaddleApi = {
  Initialize: (options: { token: string; checkout?: { settings: { displayMode: "overlay" } };
    eventCallback?: (event: { name?: string }) => void }) => void;
  Checkout: { open: (options: { transactionId: string }) => void };
};
declare global { interface Window { Paddle?: PaddleApi } }

let paddleScript: Promise<PaddleApi> | undefined;
function loadPaddle(): Promise<PaddleApi> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (!paddleScript) {
    paddleScript = new Promise<PaddleApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.onload = () => window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle checkout did not initialize."));
      script.onerror = () => reject(new Error("Paddle checkout script is unavailable."));
      document.head.appendChild(script);
    }).catch(error => { paddleScript = undefined; throw error; });
  }
  return paddleScript!;
}

export function PaddleCheckoutButton() {
  const busy = useRef(false);
  const initialized = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openCheckout() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/paddle/create-checkout", { method: "POST", cache: "no-store" });
      const payload: { transactionId?: string; clientToken?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Checkout could not be prepared.");
      if (!payload.transactionId?.startsWith("txn_") || !payload.clientToken?.startsWith("live_")) {
        throw new Error("Checkout confirmation was incomplete. Contact billing support before retrying.");
      }
      const paddle = await loadPaddle();
      if (!initialized.current) {
        paddle.Initialize({
          token: payload.clientToken,
          checkout: { settings: { displayMode: "overlay" } },
          eventCallback: event => {
            if (event.name === "checkout.completed") {
              // Checkout events are not payment proof: Pro is granted only on verified server evidence.
              window.location.assign("/pro/success");
            }
          },
        });
        initialized.current = true;
      }
      paddle.Checkout.open({ transactionId: payload.transactionId });
      setMessage("Checkout opened. Pro access activates only after server confirmation of payment.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout is temporarily unavailable.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return <div>
    <button type="button" onClick={openCheckout} disabled={loading}
      className="rounded-lg bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
      {loading ? "Opening secure checkout..." : "Upgrade to Pro"}
    </button>
    {message && <p role="status" className="mt-3 max-w-sm text-sm text-gray-600">{message}</p>}
  </div>;
}

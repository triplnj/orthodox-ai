"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function ResumePaddleCheckout({ transactionId, token, enabled }: {
  transactionId: string | null; token: string | null; enabled: boolean;
}) {
  const [message, setMessage] = useState("Preparing secure checkout...");
  useEffect(() => {
    if (!enabled || !token?.startsWith("live_")) {
      setMessage("Checkout is not open yet. No payment has been initiated.");
      return;
    }
    if (!transactionId || !/^txn_[a-z0-9]{26}$/.test(transactionId)) {
      setMessage("To start a new subscription, use the Upgrade to Pro button.");
      return;
    }
    let stopped = false;
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      if (stopped || !window.Paddle) return;
      try {
        window.Paddle.Initialize({ token, checkout: { settings: { displayMode: "overlay" } } });
        window.Paddle.Checkout.open({ transactionId });
        setMessage("Your Pro access will activate after Paddle confirms the payment.");
      } catch { setMessage("Checkout could not be opened. Contact billing support before retrying."); }
    };
    script.onerror = () => { if (!stopped) setMessage("Checkout service is temporarily unavailable."); };
    document.head.appendChild(script);
    return () => { stopped = true; script.remove(); };
  }, [transactionId, token, enabled]);

  return <main className="mx-auto max-w-xl px-6 py-16">
    <h1 className="text-3xl font-bold text-gray-950">OrthodoxAI secure checkout</h1>
    <p role="status" className="mt-5 text-base text-gray-700">{message}</p>
    <Link className="mt-8 inline-block underline" href="/pro">Return to Pro</Link>
  </main>;
}

"use client";

import { useState } from "react";
import Script from "next/script";

type PaddleSdk = {
  Environment: { set: (environment: "sandbox") => void };
  Initialize: (options: { token: string }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleSdk;
  }
}

export function PaddleSandboxReadiness({ token }: { token: string }) {
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");

  function check() {
    if (!token.startsWith("test_") || !window.Paddle) {
      setStatus("error");
      return;
    }
    try {
      window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({ token });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive" onReady={() => setScriptReady(true)}
        onError={() => setStatus("error")} />
      <h2 className="text-xl font-semibold">Paddle.js connection test</h2>
      <p className="mt-2 text-sm text-gray-600">
        Verifies Paddle Sandbox client-side initialization only. No checkout,
        payment, subscription update, or Pro access is performed here.
      </p>
      <button type="button" disabled={!scriptReady || status === "ready"}
        className="mt-4 rounded-lg bg-gray-950 px-5 py-3 text-white disabled:opacity-50"
        onClick={check}>
        {status === "ready" ? "Sandbox initialized" : "Verify Paddle.js"}
      </button>
      {status === "ready" && <p role="status" className="mt-3 text-sm text-green-700">
        Paddle.js initialized with the Sandbox client-side token.
      </p>}
      {status === "error" && <p role="alert" className="mt-3 text-sm text-red-700">
        Initialization failed. Check the Sandbox token and browser console.
      </p>}
    </section>
  );
}

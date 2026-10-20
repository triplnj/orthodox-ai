"use client";
import Link from "next/link";
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#f9fafb", color: "#111827", fontFamily: "Arial, sans-serif" }}>
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <p>OrthodoxAI</p><h1>This page is temporarily unavailable</h1>
      <p role="alert">Your request could not be completed. No operation will be retried automatically. Check saved status before repeating an interrupted submission.</p>
      <button type="button" onClick={reset} style={{ minHeight: 44, padding: "12px 20px", marginRight: 16 }}>Try loading again</button><Link href="/">Return home</Link>
    </main>
  </body></html>;
}

"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-6 py-12"><section className="rounded-2xl border border-red-200 bg-white p-6">
    <h1 className="text-2xl font-semibold">This page could not be displayed</h1>
    <p role="alert" className="mt-3 text-sm text-gray-700">Try loading the page again. This will not resubmit a form or repeat an AI request. If a previous operation was interrupted, check its saved status before submitting again.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={reset} className="rounded-lg bg-gray-950 px-4 py-3 text-white">Try loading again</button><Link href="/dashboard" className="rounded-lg border px-4 py-3">Dashboard</Link></div>
  </section></main>;
}

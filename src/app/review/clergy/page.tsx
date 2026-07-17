"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ClergyReviewPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const fullAccessHref = token
    ? `/api/review/clergy/start?token=${encodeURIComponent(token)}`
    : "";

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">
            Review access required
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-800">
            This private review page requires a valid review link.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Private clergy review access
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Welcome, Father.
        </h1>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-600">
          Thank you for taking the time to review OrthodoxAI. This private
          review access is provided so that clergy may examine the platform
          without creating an account, providing an email address, or purchasing
          a subscription.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-950">
            Purpose of this review
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            OrthodoxAI is intended as an educational tool for Orthodox Christian
            learning and daily discipline. It does not replace the Church, a
            priest, sacramental confession, pastoral guidance, medical advice,
            psychological support, or emergency services.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={fullAccessHref}
            className="rounded-xl bg-gray-950 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
          >
            Enter full OrthodoxAI review access
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
          >
            View public home page
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            What to review
          </h2>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
            <li>General Orthodox Christian answers</li>
            <li>Prayer and Scripture guidance</li>
            <li>Fasting education</li>
            <li>Confession preparation boundaries</li>
            <li>Journaling and daily rhythm features</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            What OrthodoxAI cannot do
          </h2>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
            <li>Replace a priest</li>
            <li>Hear confession</li>
            <li>Give absolution</li>
            <li>Make personal pastoral decisions</li>
            <li>Provide emergency, medical, psychological, or legal advice</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            Helpful feedback
          </h2>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
            <li>Theological concerns</li>
            <li>Pastoral risks</li>
            <li>Unclear wording</li>
            <li>Missing warnings or boundaries</li>
            <li>Features that should be changed or removed</li>
          </ul>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-950">
          Suggested test questions
        </h2>

        <div className="mt-4 grid gap-3 text-sm leading-6 text-gray-600 md:grid-cols-2">
          <p>How should a beginner start praying daily?</p>
          <p>What is the purpose of Orthodox fasting?</p>
          <p>How should I prepare for confession?</p>
          <p>Can you explain the Jesus Prayer?</p>
          <p>What should I do if I have a serious pastoral problem?</p>
          <p>Can OrthodoxAI replace guidance from my priest?</p>
        </div>
      </section>
    </main>
  );
}

export default function ClergyReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-sm text-gray-600">Loading review page...</p>
        </main>
      }
    >
      <ClergyReviewPageContent />
    </Suspense>
  );
}
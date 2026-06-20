import Link from "next/link";

export default function ProSuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Payment completed
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-green-950">
          Your OrthodoxAI Pro subscription is being activated.
        </h1>

        <p className="mt-5 text-base leading-7 text-green-900">
          Stripe has completed the Checkout flow. Your Pro status is activated
          through the webhook. If the Account page does not show Pro immediately,
          wait a few seconds and refresh.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/account"
            className="rounded-lg bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            View account
          </Link>

          <Link
            href="/today"
            className="rounded-lg border border-green-300 bg-white px-6 py-3 text-sm font-semibold text-green-950 hover:border-green-900"
          >
            Go to Today
          </Link>

          <Link
            href="/chat"
            className="rounded-lg border border-green-300 bg-white px-6 py-3 text-sm font-semibold text-green-950 hover:border-green-900"
          >
            Ask OrthodoxAI
          </Link>
        </div>
      </section>
    </main>
  );
}
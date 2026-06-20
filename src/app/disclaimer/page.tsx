import Link from "next/link";
import { productCopy } from "@/lib/productCopy";

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Important disclaimer
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-amber-950">
          OrthodoxAI is not a priest, confessor, therapist, doctor, or emergency
          service.
        </h1>

        <p className="mt-5 text-base leading-7 text-amber-900">
          {productCopy.disclaimer}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-amber-950">
          <section>
            <h2 className="text-xl font-semibold">
              1. Educational Use Only
            </h2>

            <p className="mt-3">
              OrthodoxAI is intended for educational and reflective use. It may
              help users think about prayer, fasting, Scripture, journaling, and
              Orthodox Christian daily discipline, but it is not an authority of
              the Church.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              2. Not a Replacement for the Church
            </h2>

            <p className="mt-3">
              OrthodoxAI does not replace participation in the life of the
              Church, the sacraments, confession, parish life, pastoral care, or
              guidance from a priest or spiritual father.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              3. No Confession or Pastoral Authority
            </h2>

            <p className="mt-3">
              Do not use OrthodoxAI as a substitute for confession or direct
              pastoral counsel. For serious personal spiritual matters, moral
              struggles, fasting exceptions, preparation for communion, family
              crises, addiction, abuse, or serious guilt, speak with a priest.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              4. No Medical or Mental Health Advice
            </h2>

            <p className="mt-3">
              OrthodoxAI does not provide medical, psychiatric, psychological,
              nutritional, or therapeutic advice. If your question involves
              illness, medication, pregnancy, eating disorders, addiction,
              self-harm, depression, anxiety, trauma, or another health concern,
              contact a qualified professional.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              5. Emergencies
            </h2>

            <p className="mt-3">
              If you or another person may be in immediate danger, contact local
              emergency services immediately. Do not rely on OrthodoxAI in an
              emergency.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              6. AI Limitations
            </h2>

            <p className="mt-3">
              AI-generated responses can be incomplete, inaccurate, misleading,
              or inappropriate. Users should use discernment and verify important
              matters through trusted Orthodox Christian sources and appropriate
              human guidance.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
          >
            Back to Dashboard
          </Link>

          <Link
            href="/terms"
            className="rounded-lg border border-amber-300 bg-white px-5 py-3 text-center text-sm font-semibold text-amber-950 hover:border-amber-900"
          >
            Terms of Service
          </Link>

          <Link
            href="/privacy"
            className="rounded-lg border border-amber-300 bg-white px-5 py-3 text-center text-sm font-semibold text-amber-950 hover:border-amber-900"
          >
            Privacy Policy
          </Link>
        </div>
      </section>
    </main>
  );
}
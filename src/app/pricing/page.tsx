import { FULL_ACCESS_DAILY_CHAT_LIMIT } from "@/lib/features";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PaddleLivePaymentLinkBootstrap } from "@/components/billing/PaddleLiveBridge";
import { productCopy } from "@/lib/productCopy";

const faqs = [
  {
    question: "Is OrthodoxAI a replacement for a priest?",
    answer:
      "No. OrthodoxAI is an educational assistant. It does not replace the Church, a priest, confession, pastoral counsel, medical advice, or psychological help.",
  },
  {
    question: "What do I get with the Free plan?",
    answer:
      "After registration and email verification, the Free plan includes 3 AI questions total. These questions do not renew daily. Other available free content remains accessible.",
  },
  {
    question: "What does Pro unlock?",
    answer:
      `Pro unlocks ${FULL_ACCESS_DAILY_CHAT_LIMIT} questions per day, personal prayer plans, Scripture reading plans, a spiritual journal, deeper explanations, conversation history, and future PDF export.`,
  },
  {
    question: "Can I use this for serious personal spiritual issues?",
    answer:
      "For serious personal spiritual questions, confession, fasting exceptions, family crises, mental health, addiction, or abuse, you should speak with a priest and, where appropriate, a qualified professional.",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PaddleLivePaymentLinkBootstrap />
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pricing
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
          Start free. Upgrade when OrthodoxAI becomes part of your daily rhythm.
        </h1>

        <p className="mt-5 text-base leading-7 text-gray-600">
          Use OrthodoxAI for prayer, fasting, Scripture, and practical Orthodox
          Christian guidance. The Free plan helps you start. Pro gives you
          {FULL_ACCESS_DAILY_CHAT_LIMIT} chat questions per day and deeper personal tools.
        </p>
        <p className="mt-4 text-3xl font-bold text-gray-950">
        <span className="text-base font-medium text-gray-500">$7.99/month</span>
      </p>

      <p className="mt-2 text-sm text-gray-500">
        USD $7.99 per month, recurring until canceled. Manage or cancel your subscription through the billing portal.
      </p>
      </section>

      <section className="mt-12">
        <PricingCards />
      </section>

      <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-6 text-gray-600">
        Payments for new subscriptions will be processed by Paddle once the
        checkout is approved and enabled. See our{" "}
        <a className="underline" href="/refund-policy">Refund Policy</a>
        {" "}and{" "}
        <a className="underline" href="/terms">Terms of Service</a>.
      </p>

      <section className="mt-14 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-950">
          Important note
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          {productCopy.disclaimer}
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-gray-950">
          Frequently asked questions
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold text-gray-950">{faq.question}</h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
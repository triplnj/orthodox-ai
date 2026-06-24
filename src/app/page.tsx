import Link from "next/link";
import { productCopy } from "@/lib/productCopy";

const mainFeatures = [
  {
    title: "Ask Orthodox Questions",
    description:
      "Ask about prayer, fasting, Scripture, worship, saints, Church life, and practical Orthodox living.",
  },
  {
    title: "Build a Daily Rhythm",
    description:
      "Use OrthodoxAI to create a steady rhythm of prayer, reading, reflection, and spiritual discipline.",
  },
  {
    title: "Understand Fasting",
    description:
      "Receive beginner-friendly explanations of Orthodox fasting without replacing pastoral guidance.",
  },
  {
    title: "Reflect with a Journal",
    description:
      "Organize spiritual notes, reflections, and questions you may want to bring to your priest.",
  },
];

const proFeatures = [
  "Unlimited AI questions",
  "Personal prayer plans",
  "Scripture reading plans",
  "Spiritual journal",
  "Deeper feast and fasting explanations",
  "Conversation history",
];

export default function HomePage() {
  return (
    <main>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Orthodox Christian daily assistant
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
              {productCopy.heroTitle}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              {productCopy.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
               href="/dashboard"
                className="rounded-lg bg-gray-950 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
                >
                Open Dashboard
              </Link>

              <Link
                href="/chat"
                className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
              >
                Ask OrthodoxAI
              </Link>

              <Link
                href="/pricing"
                className="rounded-lg border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
              >
                View Pro
              </Link>
            </div>

            <p className="mt-6 max-w-2xl text-xs leading-5 text-gray-500">
              {productCopy.disclaimer}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Today</p>

              <h2 className="mt-2 text-2xl font-semibold text-gray-950">
                A simple Orthodox rhythm for the day
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-6 text-gray-700">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="font-medium text-gray-950">Prayer</p>
                  <p className="mt-1">
                    Lord Jesus Christ, Son of God, have mercy on me, a sinner.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="font-medium text-gray-950">Reflection</p>
                  <p className="mt-1">
                    A small prayer rule practiced faithfully is better than a
                    large rule abandoned quickly.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="font-medium text-gray-950">AI guidance</p>
                  <p className="mt-1">
                    Ask for a prayer plan, Scripture reading suggestion, or
                    explanation of fasting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-white-950">
            More than a chatbot
          </h2>

          <p className="mt-4 text-base leading-7 text-gray-600">
            OrthodoxAI is designed as a practical daily tool for believers, not
            just a generic chat window. The chat engine powers specific features
            for prayer, fasting, Scripture, journaling, and daily discipline.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {mainFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-950">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              OrthodoxAI Pro
            </h2>

            <p className="mt-4 text-base leading-7 text-gray-300">
              For believers who want unlimited access, personal prayer plans,
              reading structure, deeper explanations, and a spiritual journal.
            </p>

            <Link
              href="/pricing"
              className="mt-8 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-100"
            >
              View Pro plan
            </Link>
            
            <p className="mt-3 text-sm text-gray-500">
            OrthodoxAI Pro — $7.99/month. Early access pricing. Cancel anytime.
            </p>
          </div>



          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <ul className="space-y-3 text-sm text-gray-200">
              {proFeatures.map((feature) => (
                <li key={feature} className="rounded-lg bg-gray-800 p-3">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
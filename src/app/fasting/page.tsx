import { ChatBox } from "@/components/chat/ChatBox";
import { productCopy } from "@/lib/productCopy";
import { FastingPlanForm } from "@/components/pro/FastingPlanForm";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { UpgradeBox } from "@/components/upgrade/UpgradeBox";


const fastingBasics = [
  {
    title: "Fasting is not just about food",
    description:
      "In Orthodox Christianity, fasting is connected with prayer, repentance, humility, self-control, almsgiving, and preparation for communion with God.",
  },
  {
    title: "Start with guidance, not extremes",
    description:
      "A beginner should not create a severe fasting rule alone. The goal is steadiness, obedience, and spiritual growth, not pride or burnout.",
  },
  {
    title: "Fasting rules can vary",
    description:
      "Exact fasting practices may vary by jurisdiction, parish practice, calendar, health, family situation, and pastoral guidance.",
  },
  {
    title: "Health matters",
    description:
      "People with illness, pregnancy, eating disorders, heavy physical work, or medical conditions should speak with a priest and a qualified medical professional.",
  },
];

const fastingTypes = [
  {
    title: "Regular weekly fasting",
    description:
      "Many Orthodox Christians fast on Wednesdays and Fridays, according to the guidance of the Church and their priest.",
  },
  {
    title: "Seasonal fasting periods",
    description:
      "The Church has major fasting seasons such as Great Lent, the Nativity Fast, the Apostles’ Fast, and the Dormition Fast.",
  },
  {
    title: "Preparation for Communion",
    description:
      "Fasting before receiving Holy Communion should be practiced according to parish and pastoral guidance.",
  },
];



export default async function FastingPage() {
  const user = await getCurrentUser();
  const isPro = user ? isProUser(user) : false;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Fasting
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Understand Orthodox fasting without turning it into legalism or
          extremes.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          OrthodoxAI can help explain the spiritual purpose of fasting, basic
          fasting practices, and careful beginner steps. It does not replace
          your priest, parish guidance, medical advice, or pastoral care.
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        {fastingBasics.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-950">
              {item.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-950">
          Common fasting contexts
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {fastingTypes.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-gray-100 bg-gray-50 p-5"
            >
              <h3 className="font-semibold text-gray-950">{item.title}</h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-semibold text-amber-950">
          Important pastoral and health note
        </h2>

        <p className="mt-3 text-sm leading-6 text-amber-900">
          Fasting should not be practiced in a way that damages your health,
          creates pride, or separates you from the life of the Church. For
          fasting exceptions, illness, pregnancy, eating disorders, family
          circumstances, or strict fasting rules, speak with your priest and,
          where needed, a qualified medical professional.
        </p>
      </section>

    <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
  <ChatBox
    contextKey="fasting"
    title="Ask OrthodoxAI about fasting"
    subtitle="Ask about the meaning of fasting, how to begin carefully, how fasting relates to prayer, or how to understand fasting seasons."
   
  />

  {isPro ? (
  <FastingPlanForm />
) : (
  <UpgradeBox
    title="Personal Fasting Guidance"
    message="Upgrade to OrthodoxAI Pro to create careful fasting guidance based on your experience level, current season, available discipline, and pastoral boundaries."
    ctaHref="/pricing"
    ctaLabel="Upgrade to Pro"
  />
)}
</section>

      <p className="mt-8 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
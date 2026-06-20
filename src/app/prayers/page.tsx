import { ChatBox } from "@/components/chat/ChatBox";
import { productCopy } from "@/lib/productCopy";
import { PrayerPlanForm } from "@/components/pro/PrayerPlanForm";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { UpgradeBox } from "@/components/upgrade/UpgradeBox";

const prayers = [
  {
    title: "The Jesus Prayer",
    text: "Lord Jesus Christ, Son of God, have mercy on me, a sinner.",
    description:
      "A short and central prayer used throughout Orthodox Christian life.",
  },
  {
    title: "Before Meals",
    text: "Christ God, bless the food and drink of Your servants, for You are holy, always, now and ever, and unto ages of ages. Amen.",
    description:
      "A simple blessing before receiving food with gratitude.",
  },
  {
    title: "After Meals",
    text: "We thank You, Christ our God, that You have satisfied us with Your earthly gifts. Do not deprive us of Your heavenly Kingdom.",
    description:
      "A short thanksgiving after meals, remembering that all good things come from God.",
  },
  {
    title: "Morning Beginning",
    text: "Glory to You, our God, glory to You.",
    description:
      "A simple phrase to begin the day with attention and gratitude.",
  },
];


export default async function PrayersPage() {
  const user = await getCurrentUser();
  const isPro = user ? isProUser(user) : false;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Prayer
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Build a simple and steady Orthodox prayer rhythm.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          OrthodoxAI can help you understand prayers, begin a realistic prayer
          habit, and organize your daily prayer rhythm. It does not replace a
          priest, confession, or personal pastoral guidance.
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        {prayers.map((prayer) => (
          <article
            key={prayer.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              {prayer.title}
            </p>

            <blockquote className="mt-4 text-lg font-medium leading-8 text-gray-950">
              “{prayer.text}”
            </blockquote>

            <p className="mt-4 text-sm leading-6 text-gray-600">
              {prayer.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
  <ChatBox
    contextKey="prayers"
    title="Ask OrthodoxAI about prayer"
    subtitle="Ask about beginning a prayer rule, understanding a prayer, or building a realistic daily rhythm."
     />

  {isPro ? (
  <PrayerPlanForm />
) : (
  <UpgradeBox
    title="Personal Prayer Plan"
    message="Upgrade to OrthodoxAI Pro to create a personalized prayer rhythm based on your experience level, available time, and current spiritual focus."
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
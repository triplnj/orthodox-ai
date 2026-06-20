import { ChatBox } from "@/components/chat/ChatBox";
import { productCopy } from "@/lib/productCopy";
import { ScripturePlanForm } from "@/components/pro/ScripturePlanForm";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { UpgradeBox } from "@/components/upgrade/UpgradeBox";

const scriptureBasics = [
  {
    title: "Begin with the Gospels",
    description:
      "For many believers, a steady reading of the Gospels is the simplest and most direct place to begin.",
  },
  {
    title: "Read with prayer",
    description:
      "Scripture is not only information. Begin with a short prayer for humility, attention, and obedience.",
  },
  {
    title: "Avoid isolated interpretation",
    description:
      "Orthodox Christians read Scripture within the life of the Church, not as detached private speculation.",
  },
  {
    title: "Bring difficult questions to the Church",
    description:
      "Difficult passages, moral questions, and spiritual confusion should be brought to a priest or trusted Orthodox teacher.",
  },
];

const readingPaths = [
  {
    title: "Beginner path",
    description:
      "Start with short daily readings from the Gospel according to Mark or Luke, followed by one short reflection question.",
  },
  {
    title: "Daily Gospel rhythm",
    description:
      "Read a short Gospel passage each day and ask: what does this reveal about Christ, repentance, mercy, and discipleship?",
  },
  {
    title: "Balanced reading",
    description:
      "Combine Gospel reading with Psalms, Acts, Epistles, and selected Old Testament readings over time.",
  },
];



export default async function ScripturePage() {
  const user = await getCurrentUser();
  const isPro = user ? isProUser(user) : false;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Scripture
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Read Scripture with prayer, steadiness, and Orthodox sensitivity.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          OrthodoxAI can help you begin a realistic Scripture reading rhythm,
          understand passages carefully, and prepare questions you may want to
          bring to your priest or Orthodox teacher.
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        {scriptureBasics.map((item) => (
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
          Suggested reading paths
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {readingPaths.map((path) => (
            <article
              key={path.title}
              className="rounded-xl border border-gray-100 bg-gray-50 p-5"
            >
              <h3 className="font-semibold text-gray-950">{path.title}</h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {path.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-950">
          A simple prayer before reading
        </h2>

        <blockquote className="mt-4 text-base leading-7 text-gray-700">
          “Lord Jesus Christ, open my heart to receive Your word with humility,
          attention, repentance, and love.”
        </blockquote>

        <p className="mt-4 text-sm leading-6 text-gray-600">
          This is not a fixed liturgical prayer. It is a simple personal prayer
          for attention before reading.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
  <ChatBox
    contextKey="scripture"
    title="Ask OrthodoxAI about Scripture"
    subtitle="Ask for a reading plan, passage explanation, reflection question, or help beginning a steady Scripture habit."
    
  />

  {isPro ? (
  <ScripturePlanForm />
) : (
  <UpgradeBox
    title="Personal Scripture Reading Plan"
    message="Upgrade to OrthodoxAI Pro to create a personalized Scripture reading rhythm based on your experience level, available time, and spiritual goal."
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
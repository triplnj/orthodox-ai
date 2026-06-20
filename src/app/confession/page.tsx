import { ChatBox } from "@/components/chat/ChatBox";
import { productCopy } from "@/lib/productCopy";

const preparationSteps = [
  {
    title: "Pray for honesty",
    description:
      "Begin quietly. Ask God for humility, courage, repentance, and clarity rather than emotional intensity.",
  },
  {
    title: "Review your life simply",
    description:
      "Look at your relationship with God, your neighbor, your family, your speech, your thoughts, your habits, and your responsibilities.",
  },
  {
    title: "Name patterns, not only incidents",
    description:
      "It may help to notice repeated patterns: pride, anger, resentment, distraction, laziness, impurity, envy, fear, or lack of love.",
  },
  {
    title: "Prepare to speak plainly",
    description:
      "Confession is not a performance. Prepare to speak truthfully, without self-justification and without unnecessary detail.",
  },
];

const selfExaminationGroups = [
  {
    title: "Before God",
    questions: [
      "Have I neglected prayer or treated God as distant or secondary?",
      "Have I trusted more in comfort, fear, money, control, or approval than in God?",
      "Have I approached worship, fasting, or Scripture carelessly or mechanically?",
    ],
  },
  {
    title: "Toward other people",
    questions: [
      "Have I judged, mocked, envied, manipulated, ignored, or used others?",
      "Have I refused forgiveness or held on to resentment?",
      "Have I failed in love toward family, neighbors, coworkers, or people in need?",
    ],
  },
  {
    title: "Speech and attention",
    questions: [
      "Have I lied, gossiped, slandered, complained, boasted, or spoken harshly?",
      "Have I used my attention carelessly through distraction, entertainment, anger, or impurity?",
      "Have I avoided silence, prayer, or honest self-knowledge?",
    ],
  },
  {
    title: "Habits and responsibilities",
    questions: [
      "Have I been careless with work, family duties, health, money, time, or promises?",
      "Have I allowed addictions, compulsions, or secret habits to rule me?",
      "Have I excused repeated sins instead of seeking help and repentance?",
    ],
  },
];

const practicalReminders = [
  "Do not try to confess every tiny detail in a confused way. Seek clarity and honesty.",
  "Do not turn confession into self-hatred. Repentance is not despair.",
  "Do not use confession to blame others. Focus on your own responsibility.",
  "If something is serious, painful, abusive, addictive, or dangerous, speak directly with a priest and appropriate qualified help.",
];

const beginnerPrompt = `
Help me prepare for confession in a simple Orthodox Christian way.
Do not ask me to confess detailed sins to you.
Help me organize my thoughts, identify general areas for self-examination, and prepare questions I may bring to a priest.

`;

export default function ConfessionPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Important boundary
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-amber-950">
          Confession Preparation
        </h1>

        <p className="mt-4 max-w-4xl text-base leading-7 text-amber-900">
          This page helps you prepare for sacramental confession. It is not
          confession itself. OrthodoxAI does not receive confession, give
          absolution, assign penances, or replace your priest or spiritual
          father.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Preparation
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white-950">
            Prepare with honesty, simplicity, and hope.
          </h2>

          <p className="mt-4 text-sm leading-6 text-gray-600">
            Confession preparation should help you come before God truthfully,
            without panic, theatrical emotion, or self-justification. The goal is
            repentance, healing, and reconciliation with God through the life of
            the Church.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {preparationSteps.map((step) => (
              <article
                key={step.title}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-gray-950">{step.title}</h3>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            Before you go
          </h2>

          <div className="mt-5 space-y-4">
            {practicalReminders.map((reminder) => (
              <div
                key={reminder}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-sm leading-6 text-gray-700">{reminder}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Self-examination
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white-950">
          Questions for quiet reflection
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">
          These questions are not a legal checklist. Use them to notice what you
          need to bring honestly to confession.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {selfExaminationGroups.map((group) => (
            <article
              key={group.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-950">
                {group.title}
              </h3>

              <ul className="mt-4 space-y-3">
                {group.questions.map((question) => (
                  <li
                    key={question}
                    className="text-sm leading-6 text-gray-700"
                  >
                    <span className="mr-2 text-gray-400">•</span>
                    {question}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <ChatBox
          contextKey="confession"
          title="Ask OrthodoxAI about confession preparation"
          subtitle="Ask for general help preparing for confession. Do not use this chat as confession itself."
          initialPrompt={beginnerPrompt.trim()}
        />

        <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            What this tool can and cannot do
          </h2>

          <div className="mt-5 space-y-4 text-sm leading-6 text-gray-700">
            <p>
              It can help you organize thoughts, identify general themes, and
              prepare questions to bring to a priest.
            </p>

            <p>
              It cannot hear confession, judge your soul, give absolution,
              assign penance, or replace direct pastoral guidance.
            </p>

            <p>
              For serious spiritual, family, medical, psychological, addictive,
              abusive, or emergency situations, speak directly with a priest and
              appropriate qualified help.
            </p>
          </div>
        </aside>
      </section>

      <p className="mt-10 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
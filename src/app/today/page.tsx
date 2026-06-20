import { ChatBox } from "@/components/chat/ChatBox";
import { TodayCard } from "@/components/today/TodayCard";
import { productCopy } from "@/lib/productCopy";

const todayData = {
  dateLabel: "Today",
  spiritualFocus: "A simple Orthodox rhythm for the day",
  prayer: "Lord Jesus Christ, Son of God, have mercy on me, a sinner.",
  fasting:
    "Check your local Orthodox calendar and parish guidance for the exact fasting rule.",
  reflection:
    "A small prayer rule practiced faithfully is better than a large rule abandoned quickly.",
};

export default function TodayPage() {
  

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {todayData.dateLabel}
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          {todayData.spiritualFocus}
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          Use this page as a daily starting point for prayer, fasting,
          Scripture, and reflection.
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        <TodayCard
          title="Daily prayer"
          value={todayData.prayer}
          description="A short prayer can help establish attention, humility, and steadiness."
        />

        <TodayCard
          title="Fasting note"
          value={todayData.fasting}
          description="Fasting rules can vary by jurisdiction, parish practice, health, and pastoral guidance."
        />

        <TodayCard
          title="Reflection"
          value={todayData.reflection}
          description="Consistency is often more important than intensity at the beginning."
        />
      </section>

      <section className="mt-10">
        <ChatBox
          contextKey="today"
          title="Ask OrthodoxAI about today"
          subtitle="Ask for a simple prayer plan, Scripture reading suggestion, fasting explanation, or spiritual focus for the day."
   
    
        />
      </section>

      <p className="mt-8 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
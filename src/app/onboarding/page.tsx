"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  const [spiritualGoal, setSpiritualGoal] = useState("build prayer habit");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [dailyTime, setDailyTime] = useState("10 minutes");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spiritualGoal,
          experienceLevel,
          dailyTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not save onboarding.");
        return;
      }

      router.push("/dashboard?verify=sent");
      router.refresh();
    } catch {
      setError("Network error while saving onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Setup
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Set up your OrthodoxAI rhythm.
        </h1>

        <p className="mt-4 text-sm leading-6 text-gray-600">
          Choose your main focus so OrthodoxAI can guide you toward a realistic
          prayer, Scripture, fasting, and reflection rhythm.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={completeOnboarding} className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-semibold text-gray-800">
              What is your main goal right now?
            </label>

            <div className="mt-3 grid gap-3">
              {[
                {
                  value: "build prayer habit",
                  label: "Build a daily prayer habit",
                },
                {
                  value: "understand fasting",
                  label: "Understand Orthodox fasting",
                },
                {
                  value: "read Scripture",
                  label: "Read Scripture more consistently",
                },
                {
                  value: "use spiritual journal",
                  label: "Use a spiritual journal",
                },
                {
                  value: "learn Orthodox basics",
                  label: "Learn Orthodox Christian basics",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={
                    spiritualGoal === option.value
                      ? "cursor-pointer rounded-xl border border-gray-950 bg-gray-50 p-4 text-sm font-medium text-gray-950"
                      : "cursor-pointer rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:border-gray-400"
                  }
                >
                  <input
                    type="radio"
                    name="spiritualGoal"
                    value={option.value}
                    checked={spiritualGoal === option.value}
                    onChange={(event) => setSpiritualGoal(event.target.value)}
                    className="mr-3"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-800">
              Experience level
            </label>

            <select
              value={experienceLevel}
              onChange={(event) => setExperienceLevel(event.target.value)}
              className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            >
              <option value="beginner">Beginner</option>
              <option value="returning">Returning after a break</option>
              <option value="regular but inconsistent">
                Regular but inconsistent
              </option>
              <option value="experienced">Experienced</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-800">
              How much time can you realistically give each day?
            </label>

            <select
              value={dailyTime}
              onChange={(event) => setDailyTime(event.target.value)}
              className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            >
              <option value="5 minutes">5 minutes</option>
              <option value="10 minutes">10 minutes</option>
              <option value="15 minutes">15 minutes</option>
              <option value="20 minutes">20 minutes</option>
              <option value="30 minutes">30 minutes</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Continue to Dashboard"}
          </button>
        </form>
      </section>
    </main>
  );
}
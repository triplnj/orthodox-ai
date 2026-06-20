"use client";

import { useState } from "react";
import Link from "next/link";

export function FastingPlanForm() {
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [fastingContext, setFastingContext] = useState("ordinary week");
  const [availableDiscipline, setAvailableDiscipline] = useState(
    "small and realistic changes"
  );
  const [currentChallenge, setCurrentChallenge] = useState(
    "I want to begin fasting carefully without becoming extreme."
  );

  const [plan, setPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createFastingPlan() {
    setIsLoading(true);
    setError(null);
    setPlan(null);
    setUpgradeRequired(false);

    try {
      const response = await fetch("/api/pro/fasting-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          experienceLevel,
          fastingContext,
          availableDiscipline,
          currentChallenge,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not create fasting guidance.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      setPlan(data.plan);
    } catch {
      setError("Network error while creating fasting guidance.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pro tool
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-gray-950">
          Personal Fasting Guidance
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          Create a careful fasting support plan that keeps the focus on prayer,
          repentance, simplicity, and pastoral guidance.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Experience level
          </label>

          <select
            value={experienceLevel}
            onChange={(event) => setExperienceLevel(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="beginner">Beginner</option>
            <option value="returning to fasting">Returning to fasting</option>
            <option value="fasts sometimes">Fasts sometimes</option>
            <option value="regular but inconsistent">
              Regular but inconsistent
            </option>
            <option value="already follows a parish fasting rhythm">
              Already follows a parish fasting rhythm
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Fasting context
          </label>

          <select
            value={fastingContext}
            onChange={(event) => setFastingContext(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="ordinary week">Ordinary week</option>
            <option value="Wednesday and Friday fasting">
              Wednesday and Friday fasting
            </option>
            <option value="Great Lent">Great Lent</option>
            <option value="Nativity Fast">Nativity Fast</option>
            <option value="Apostles’ Fast">Apostles’ Fast</option>
            <option value="Dormition Fast">Dormition Fast</option>
            <option value="preparing for confession and communion">
              Preparing for confession and communion
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Available discipline
          </label>

          <select
            value={availableDiscipline}
            onChange={(event) => setAvailableDiscipline(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="small and realistic changes">
              Small and realistic changes
            </option>
            <option value="moderate discipline">Moderate discipline</option>
            <option value="mostly food simplicity">Mostly food simplicity</option>
            <option value="focus on prayer and self-control">
              Focus on prayer and self-control
            </option>
            <option value="needs a very gentle approach">
              Needs a very gentle approach
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Current challenge
          </label>

          <textarea
            value={currentChallenge}
            onChange={(event) => setCurrentChallenge(event.target.value)}
            className="mt-2 min-h-28 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <button
          type="button"
          onClick={createFastingPlan}
          disabled={isLoading}
          className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Creating guidance..." : "Create fasting guidance"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>

          {upgradeRequired && (
            <Link
              href="/pricing"
              className="mt-3 inline-block rounded-lg bg-gray-950 px-4 py-2 text-white"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
      )}

      {plan && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-5">
          <h3 className="text-lg font-semibold text-gray-950">
            Your fasting guidance
          </h3>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {plan}
          </p>
        </div>
      )}
    </section>
  );
}
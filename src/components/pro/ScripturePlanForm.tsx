"use client";

import { useState } from "react";
import Link from "next/link";

export function ScripturePlanForm() {
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [availableTime, setAvailableTime] = useState("10 minutes per day");
  const [goal, setGoal] = useState("build a daily Gospel reading habit");

  const [plan, setPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createScripturePlan() {
    setIsLoading(true);
    setError(null);
    setPlan(null);
    setUpgradeRequired(false);

    try {
      const response = await fetch("/api/pro/scripture-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          experienceLevel,
          availableTime,
          goal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not create Scripture reading plan.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      setPlan(data.plan);
    } catch {
      setError("Network error while creating Scripture reading plan.");
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
          Scripture Reading Plan
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          Create a realistic Orthodox Christian Scripture reading rhythm based
          on your level, available time, and current reading goal.
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
            <option value="returning to Scripture">Returning to Scripture</option>
            <option value="reads occasionally">Reads occasionally</option>
            <option value="already reads daily">Already reads daily</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Available time
          </label>

          <select
            value={availableTime}
            onChange={(event) => setAvailableTime(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="5 minutes per day">5 minutes per day</option>
            <option value="10 minutes per day">10 minutes per day</option>
            <option value="15 minutes per day">15 minutes per day</option>
            <option value="20 minutes per day">20 minutes per day</option>
            <option value="30 minutes per day">30 minutes per day</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Reading goal
          </label>

          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="mt-2 min-h-28 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <button
          type="button"
          onClick={createScripturePlan}
          disabled={isLoading}
          className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Creating plan..." : "Create Scripture plan"}
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
            Your Scripture reading plan
          </h3>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {plan}
          </p>
        </div>
      )}
    </section>
  );
}
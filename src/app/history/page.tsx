"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UpgradeBox } from "@/components/upgrade/UpgradeBox";
import { productCopy } from "@/lib/productCopy";

type HistoryMessage = {
  id: string;
  role: string;
  content: string;
  category: string | null;
  createdAt: string;
};

export default function HistoryPage() {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<"FREE" | "PRO" | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/history");
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not load conversation history.");
          return;
        }

        setMessages(data.messages);
        setPlan(data.plan);
        setIsPro(data.isPro);
        setLimit(data.limit);
      } catch {
        setError("Network error while loading conversation history.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Conversation History
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Review your previous OrthodoxAI conversations.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          Your history helps you return to previous questions, useful answers,
          prayer guidance, Scripture reading suggestions, and reflections.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              Current access
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Plan: <span className="font-medium">{plan ?? "unknown"}</span>
              {limit !== null && (
                <>
                  {" "}
                  · Showing latest{" "}
                  <span className="font-medium">{limit}</span> messages
                </>
              )}
            </p>
          </div>

          <Link
            href="/chat"
            className="rounded-lg bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
          >
            Ask a new question
          </Link>
        </div>
      </section>

      {!isPro && (
        <section className="mt-8">
          <UpgradeBox
            title="Pro feature: Extended Conversation History"
            message="Free users can view a limited recent history. OrthodoxAI Pro will unlock extended conversation history together with unlimited questions, personal prayer plans, Scripture reading plans, and the Spiritual Journal."
          />
        </section>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-8">
        {isLoading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading conversation history...
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm leading-6 text-gray-600 shadow-sm">
            No conversation history yet. Start by asking OrthodoxAI a question.
          </div>
        )}

        <div className="space-y-5">
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {message.role}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Category: {message.category ?? "general"} ·{" "}
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                {message.content}
              </p>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
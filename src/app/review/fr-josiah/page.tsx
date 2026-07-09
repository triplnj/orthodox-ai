"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function ReviewPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [contextKey, setContextKey] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const hasToken = Boolean(token);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    setIsLoading(true);
    setError("");

    const userMessage = message.trim();

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");

    try {
      const response = await fetch("/api/review/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          message: userMessage,
          contextKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not generate an answer.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch {
      setError("Network error while contacting OrthodoxAI.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!hasToken) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">
            Review access required
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-800">
            This private review page requires a valid review link.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Private review access
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          OrthodoxAI Review Page
        </h1>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-600">
          This private page provides review access to OrthodoxAI without
          requiring registration, sign-in, email submission, or subscription.
          It is intended for theological, pastoral, and practical evaluation.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-950">
            Important boundaries
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            OrthodoxAI is an educational tool. It does not replace the Church,
            a priest, sacramental confession, pastoral guidance, medical advice,
            psychological support, or emergency services.
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/"
          className="rounded-2xl border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-950"
        >
          Home page
        </Link>

        <Link
          href="/pricing"
          className="rounded-2xl border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-950"
        >
          Pricing page
        </Link>

        <Link
          href="/terms"
          className="rounded-2xl border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-950"
        >
          Terms of Service
        </Link>

        <Link
          href="/privacy"
          className="rounded-2xl border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-950"
        >
          Privacy Policy
        </Link>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            Suggested review areas
          </h2>

          <div className="mt-5 space-y-4 text-sm leading-6 text-gray-600">
            <p>
              You may test how OrthodoxAI answers questions about prayer,
              fasting, Scripture, confession preparation, and Orthodox Christian
              life.
            </p>

            <p>
              The context selector below changes the type of answer OrthodoxAI
              tries to provide.
            </p>
          </div>

          <label className="mt-6 block text-sm font-medium text-gray-700">
            Review context
          </label>

          <select
            value={contextKey}
            onChange={(event) => setContextKey(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="general">General Orthodox Q&A</option>
            <option value="prayers">Prayer guidance</option>
            <option value="fasting">Fasting guidance</option>
            <option value="scripture">Scripture reading</option>
            <option value="confession">Confession preparation</option>
            <option value="journal">Spiritual journal</option>
            <option value="today">Daily rhythm</option>
          </select>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-600">
            Suggested questions:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>How should a beginner start praying daily?</li>
              <li>What is the purpose of Orthodox fasting?</li>
              <li>How should I prepare for confession?</li>
              <li>Can you explain the Jesus Prayer?</li>
              <li>What should I do if I have a serious pastoral problem?</li>
            </ul>
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            Review chat
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            This chat is provided only for review purposes and does not require
            an OrthodoxAI account.
          </p>

          <div className="mt-6 min-h-[360px] space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                Ask a question to test OrthodoxAI.
              </p>
            )}

            {messages.map((item, index) => (
              <article
                key={`${item.role}-${index}`}
                className={
                  item.role === "user"
                    ? "rounded-xl bg-white p-4 text-sm leading-6 text-gray-800"
                    : "rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-800"
                }
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {item.role === "user" ? "Question" : "OrthodoxAI"}
                </p>

                <p className="whitespace-pre-wrap">{item.content}</p>
              </article>
            ))}

            {isLoading && (
              <p className="text-sm text-gray-500">
                OrthodoxAI is preparing an answer...
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={sendMessage} className="mt-5 space-y-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Ask a review question..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            />

            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send question"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

export default function FrJosiahReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-gray-600">Loading review page...</p>
        </main>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
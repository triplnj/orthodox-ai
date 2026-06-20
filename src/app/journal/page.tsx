"use client";

import { useEffect, useState } from "react";
import { UpgradeBox } from "@/components/upgrade/UpgradeBox";
import { productCopy } from "@/lib/productCopy";

type JournalEntry = {
  id: string;
  title: string | null;
  content: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

 

  async function saveEntry() {
    if (!content.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not save journal entry.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      setTitle("");
      setContent("");
      setEntries((current) => [data.entry, ...current]);
      setUpgradeRequired(false);
    } catch {
      setError("Network error while saving journal entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function summarizeEntry(entryId: string) {
    setSummarizingId(entryId);
    setError(null);

    try {
      const response = await fetch("/api/journal/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not summarize journal entry.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      setEntries((current) =>
        current.map((entry) =>
          entry.id === entryId ? data.entry : entry
        )
      );
    } catch {
      setError("Network error while summarizing journal entry.");
    } finally {
      setSummarizingId(null);
    }
  }

useEffect(() => {
  async function loadEntries() {
    setIsLoadingEntries(true);
    setError(null);

    try {
      const response = await fetch("/api/journal");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not load journal entries.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      setEntries(data.entries);
      setUpgradeRequired(false);
    } catch {
      setError("Network error while loading journal entries.");
    } finally {
      setIsLoadingEntries(false);
    }
  }

  loadEntries();
}, []);
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Spiritual Journal
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Organize your reflections, questions, and daily spiritual notes.
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          The journal helps you write down reflections, struggles, prayer notes,
          and questions you may want to bring to your priest. OrthodoxAI can
          summarize entries, but it does not act as a confessor or spiritual
          father.
        </p>
      </section>

      {upgradeRequired && (
        <section className="mt-8">
          <UpgradeBox
            title="Pro feature: Spiritual Journal"
            message="The Spiritual Journal is available with OrthodoxAI Pro. Pro gives you journal entries, AI summaries, personal prayer plans, Scripture reading plans, and unlimited questions."
          />
        </section>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {!upgradeRequired && (
        <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              New journal entry
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Title
                </label>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
               
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Reflection
                </label>

                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
               
                  className="mt-2 min-h-56 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-950"
                />
              </div>

              <button
                type="button"
                onClick={saveEntry}
                disabled={isSaving || !content.trim()}
                className="w-full rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save entry"}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              Previous entries
            </h2>

            {isLoadingEntries && (
              <p className="mt-5 text-sm text-gray-500">
                Loading journal entries...
              </p>
            )}

            {!isLoadingEntries && entries.length === 0 && (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 text-sm leading-6 text-gray-600 shadow-sm">
                No journal entries yet. Write your first reflection on the left.
              </div>
            )}

            <div className="mt-5 space-y-5">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-950">
                        {entry.title ?? "Untitled reflection"}
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => summarizeEntry(entry.id)}
                      disabled={summarizingId === entry.id}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {summarizingId === entry.id
                        ? "Summarizing..."
                        : "AI summary"}
                    </button>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {entry.content}
                  </p>

                  {entry.aiSummary && (
                    <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-950">
                        OrthodoxAI summary
                      </p>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {entry.aiSummary}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="mt-8 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}
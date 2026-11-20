"use client";

import { useEffect, useId, useState } from "react";

// Keep the survey out of the page layout until the authenticated feedback endpoint
// confirms that the user has not already responded.
const DISMISS_KEY = "orthodoxai-feedback-dismissed-session";

export function ActivationSurvey() {
  const formId = useId();
  const [reason, setReason] = useState("");
  const [feature, setFeature] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;
    fetch("/api/activation-feedback", { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then(data => {
        if (mounted) {
          setDone(Boolean(data.feedback));
          setReady(true);
        }
      })
      .catch(() => { if (mounted) setReady(false); });
    return () => { mounted = false; };
  }, []);

  if (!ready || done) return null;

  function dismiss() {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    setDone(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || !feature || saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/activation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, feature, suggestion }),
      });
      if (!response.ok) throw new Error("Submission failed");
      setDone(true);
    } catch {
      setError("Feedback could not be submitted. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="activation-survey" aria-labelledby="activation-survey-title"
      className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-950 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <h2 id="activation-survey-title" className="text-sm font-semibold sm:text-base">
              Help us improve OrthodoxAI
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-600 sm:text-sm">
              What would make OrthodoxAI more useful to you? Share your thoughts in about a minute.
            </p>
          </div>
          <button type="button" aria-expanded={expanded} aria-controls={formId}
            onClick={() => setExpanded(value => !value)}
            className="min-h-10 shrink-0 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
            {expanded ? "Close form" : "Share feedback"}
          </button>
          <button type="button" onClick={dismiss} aria-label="Dismiss feedback invitation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {expanded && (
          <form id={formId} className="mt-4 space-y-4 border-t border-gray-100 pt-4" onSubmit={submit}>
            <p className="text-xs text-gray-600">
              Optional feedback. Do not include private spiritual or confession details.
            </p>
            <div>
              <label htmlFor="feedback-reason" className="block text-sm font-semibold">
                What is the main reason you haven&apos;t used OrthodoxAI more or upgraded to Pro?
              </label>
              <select id="feedback-reason" value={reason} onChange={event => setReason(event.target.value)}
                required className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-950">
                <option value="">Select an answer</option>
                <option value="not_using">I have not tried enough features yet</option>
                <option value="price">The Pro plan does not fit my needs or budget</option>
                <option value="unclear_value">I am not sure what Pro would add for me</option>
                <option value="answer_quality">I need more reliable or useful answers</option>
                <option value="other">Other (including payment difficulties)</option>
              </select>
            </div>
            <div>
              <label htmlFor="feedback-feature" className="block text-sm font-semibold">
                Which feature interests you most?
              </label>
              <select id="feedback-feature" value={feature} onChange={event => setFeature(event.target.value)}
                required className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-950">
                <option value="">Select an answer</option>
                <option value="patristics">Church Fathers and Patristics</option>
                <option value="chat">AI Chat</option>
                <option value="journal">Spiritual Journal</option>
                <option value="confession">Confession Preparation</option>
                <option value="prayer">Prayer and Scripture tools</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="feedback-suggestion" className="block text-sm font-semibold">
                What should we improve? (optional)
              </label>
              <textarea id="feedback-suggestion" maxLength={500} value={suggestion}
                onChange={event => setSuggestion(event.target.value)} rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-gray-950" />
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving || !reason || !feature}
              className="min-h-10 rounded-lg bg-gray-950 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Submitting..." : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

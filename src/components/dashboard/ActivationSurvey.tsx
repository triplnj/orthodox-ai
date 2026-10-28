"use client";

import { useEffect, useState } from "react";

export function ActivationSurvey() {
  const [reason, setReason] = useState("");
  const [feature, setFeature] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    fetch("/api/activation-feedback", { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("unavailable"); return r.json(); })
      .then(data => { if (mounted) { setDone(Boolean(data.feedback)); setReady(true); } })
      .catch(() => { if (mounted) setReady(false); });
    return () => { mounted = false; };
  }, []);
  if (!ready || done) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || !feature) return;
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
    <section aria-labelledby="activation-survey-title" className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Optional feedback · About 1 minute</p>
      <h2 id="activation-survey-title" className="mt-2 text-2xl font-semibold">Help us improve OrthodoxAI</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">Your feedback helps us prioritize improvements. Please do not include private spiritual or confession details.</p>
      <form className="mt-5 space-y-5" onSubmit={submit}>
        <div>
          <label htmlFor="feedback-reason" className="block text-sm font-semibold">What is the main reason you have not upgraded to Pro?</label>
          <select id="feedback-reason" value={reason} onChange={e=>setReason(e.target.value)} required className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-950">
            <option value="">Select an answer</option>
            <option value="not_using">I do not use OrthodoxAI often enough</option>
            <option value="price">The price is too high</option>
            <option value="unclear_value">I am not sure what Pro offers</option>
            <option value="answer_quality">The answers need improvement</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="feedback-feature" className="block text-sm font-semibold">Which feature interests you most?</label>
          <select id="feedback-feature" value={feature} onChange={e=>setFeature(e.target.value)} required className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-950">
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
          <label htmlFor="feedback-suggestion" className="block text-sm font-semibold">What could make OrthodoxAI more useful? (optional)</label>
          <textarea id="feedback-suggestion" maxLength={500} value={suggestion} onChange={e=>setSuggestion(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-gray-950" />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={saving || !reason || !feature} type="submit" className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
          {saving ? "Submitting..." : "Send feedback"}
        </button>
      </form>
    </section>
  );
}

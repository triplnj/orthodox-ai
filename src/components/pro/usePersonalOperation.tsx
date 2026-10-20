"use client";
import { useEffect, useRef, useState } from "react";
import { errorMessage, newerQuota, type ClientQuota } from "@/lib/api/clientErrors";

export function usePersonalOperation(feature: string, onSaved: (data: Record<string, unknown>) => void) {
  const pending = useRef<{ requestId: string; body: Record<string, unknown> | null } | null>(null);
  const active = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [quota, setQuota] = useState<ClientQuota | null>(null);
  const storageKey = `orthodox-ai:pending:${feature}`;
  const remember = () => { try { if (pending.current) sessionStorage.setItem(storageKey, pending.current.requestId); else sessionStorage.removeItem(storageKey); } catch {} };
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const requestId = sessionStorage.getItem(storageKey);
        if (requestId && !cancelled) { pending.current = { requestId, body: null }; setUncertain(true); }
        const response = await fetch(`/api/ai/usage?feature=${encodeURIComponent(feature)}`);
        const data = await response.json(); if (response.ok && !cancelled) setQuota(current => newerQuota(current, data.quota));
      } catch {}
    });
    return () => { cancelled = true; };
  }, [storageKey, feature]);
  async function submit(body: Record<string, unknown>): Promise<Response> {
    if (active.current || (pending.current?.body && JSON.stringify(pending.current.body) !== JSON.stringify(body))) {
      return Response.json({ error: "Check or recover the previous request before starting a different one.", code: "AI_OPERATION_IN_PROGRESS" }, { status: 409 });
    }
    const wasPending = Boolean(pending.current);
    pending.current ??= { requestId: crypto.randomUUID(), body };
    pending.current.body ??= body;
    remember(); active.current = true; setBusy(true);
    try {
      const response = await fetch(feature === "journal-summary" ? "/api/journal/summarize" : `/api/pro/${feature}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId: pending.current.requestId }),
      });
      const data = await response.clone().json(); setQuota(current => newerQuota(current, data.quota));
      if (response.ok || (!wasPending && [400, 401, 403, 404, 413, 415, 429].includes(response.status))) {
        pending.current = null; remember(); setUncertain(false);
      } else { if ([400, 413, 415].includes(response.status)) pending.current!.body = null; setUncertain(true); setNotice(errorMessage(data)); }
      return response;
    } catch (error) { setUncertain(true); setNotice("The result is uncertain. Check saved status or recover the request; retrying must keep the same request ID."); throw error; }
    finally { active.current = false; setBusy(false); }
  }
  async function check(recover = false) {
    if (!pending.current || active.current) return;
    active.current = true; setBusy(true);
    try {
      const identity = { feature, requestId: pending.current.requestId };
      const response = recover ? await fetch("/api/ai/requests/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(identity) })
        : await fetch(`/api/ai/requests?${new URLSearchParams(identity)}`);
      const data = await response.json(); setQuota(current => newerQuota(current, data.quota));
      if (response.ok && (recover || data.replayed)) {
        if (data.replayed) onSaved(data);
        pending.current = null; remember(); setUncertain(false); setNotice(recover ? data.message : "Loaded the saved result without another AI request.");
      } else if (data.status === "RESULT_EXPIRED") {
        pending.current = null; remember(); setUncertain(false); setNotice("No replayable result is available. A new submission uses normal quota.");
      } else if (response.status === 404) setNotice("No request is recorded yet. Retry using the same request ID; a missing status does not prove that an earlier network request cannot still arrive.");
      else setNotice(data.error ?? "The operation has not completed. Recovery fences its result; it does not cancel provider billing or refund usage.");
    } catch { setNotice("Could not check status. Keep this request pending and try checking again."); }
    finally { active.current = false; setBusy(false); }
  }
  const controls = <div className="mt-3 text-sm" aria-live="polite">
    {quota && <p>Remaining {quota.pool} requests today: {quota.remaining} of {quota.limit}.</p>}
    {notice && <p>{notice}</p>}
    {uncertain && <div className="mt-2 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void check()} className="rounded-lg border border-gray-300 px-3 py-2 underline">Check saved result</button>
      <button type="button" disabled={busy} onClick={() => void check(true)} className="rounded-lg border border-gray-300 px-3 py-2 underline">Fence previous attempt and allow a new request</button>
    </div>}
  </div>;
  // Retrying through the original form always keeps the pending key. It never
  // creates a fresh execution merely because status lookup returned 404.
  return { submit, controls, blocked: busy };
}

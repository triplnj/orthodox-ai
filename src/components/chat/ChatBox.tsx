"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatContextKey } from "@/lib/ai/chatContexts";
import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";
import { SourceCards } from "./SourceCards";
import { errorMessage, newerQuota, type ClientQuota } from "@/lib/api/clientErrors";

type Message = { role: string; content: string; sources?: PatristicResearchSource[] };
type Interrupted = { id: string; question: string; status: string };
type SavedConversation = { id: string; contextKey: string; updatedAt?: string };
type PendingRequest = { requestId: string; message: string; contextKey: ChatContextKey; conversationId?: string };
export function ChatBox({ contextKey = "general", title = "Ask OrthodoxAI",
  subtitle = "Ask a question about Orthodox prayer, fasting, Scripture, worship, or daily spiritual life.", initialPrompt = "" }: {
    contextKey?: ChatContextKey; title?: string; subtitle?: string; initialPrompt?: string;
  }) {
  const [input, setInput] = useState(initialPrompt);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [feature, setFeature] = useState(contextKey);
  const [saved, setSaved] = useState<SavedConversation[]>([]);
  const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const quotaRef = useRef<ClientQuota | null>(null);
  function updateQuota(data: { quota?: ClientQuota; remaining?: number }) {
    quotaRef.current = newerQuota(quotaRef.current, data.quota);
    if (quotaRef.current) setRemaining(quotaRef.current.remaining);
    else if (typeof data.remaining === "number") setRemaining(data.remaining);
  }
  const [upgrade, setUpgrade] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<PendingRequest | null>(null);
  const inFlight = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const readVersion = useRef(0);
  const drafts = useRef<Record<string, string>>({});
  const inputRef = useRef(input);
  inputRef.current = input;
  const currentConversation = useRef(conversationId);
  currentConversation.current = conversationId;
  useEffect(() => {
    const element = transcript.current;
    if (element && nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages, busy]);
  async function readSaved(id?: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setLoadingConversation(true); setError(null);
    try { if (id) await loadConversation(id); else await refreshList(); }
    catch { setError("Could not load saved conversations. Your current messages and draft are preserved. Try checking again."); }
    finally { inFlight.current = false; setBusy(false); setLoadingConversation(false); }
  }

  async function refreshList(signal?: AbortSignal) {
    const response = await fetch("/api/conversations", { signal });
    const data = await response.json();
    if (!response.ok) throw new Error("Could not load conversations.");
    if (signal?.aborted) return;
    const all: SavedConversation[] = data.conversations ?? [];
    for (const id of data.interruptedConversationIds ?? []) if (!all.some(item => item.id === id)) all.unshift({ id, contextKey: "interrupted" });
    setSaved(all);
  }
  async function loadConversation(id: string, signal?: AbortSignal) {
    const version = ++readVersion.current;
    const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load conversation.");
    if (signal?.aborted || version !== readVersion.current) return;
    drafts.current[currentConversation.current ?? "new"] = inputRef.current;
    setInput(drafts.current[id] ?? "");
    setConversationId(id); setFeature(data.contextKey);
    setMessages((data.messages ?? []).map((message: { role: string; content: string; sources: { snapshot: PatristicResearchSource }[] }) => ({
      role: message.role, content: message.content, sources: (message.sources ?? []).map(source => source.snapshot),
    })));
    setInterrupted(data.interruptedTurn); setUncertain(false); pending.current = null;
    const url = new URL(window.location.href); url.searchParams.set("conversationId", id); window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get("conversationId");
    inFlight.current = true;
    void Promise.resolve().then(() => { if (controller.signal.aborted) return; if (id) { setBusy(true); setLoadingConversation(true); } return Promise.all([refreshList(controller.signal), id ? loadConversation(id, controller.signal) : Promise.resolve(),
      fetch("/api/ai/usage?feature=chat", { signal: controller.signal }).then(async response => { if (response.ok && !controller.signal.aborted) updateQuota(await response.json()); })]); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load conversations. Your draft is preserved. Check saved status to try again."); })
      .finally(() => { if (!controller.signal.aborted) { inFlight.current = false; setBusy(false); setLoadingConversation(false); } });
    return () => controller.abort();
  }, []);

  async function sendMessage(retry = false) {
    if (inFlight.current || interrupted || (!retry && (uncertain || !input.trim()))) return;
    const payload = retry ? pending.current : { requestId: crypto.randomUUID(), message: input.trim(), contextKey: feature, conversationId };
    if (!payload) return;
    inFlight.current = true; setBusy(true); setError(null); setNotice(null); setUpgrade(false);
    drafts.current[conversationId ?? "new"] = payload.message;
    if (!retry) {
      pending.current = payload;
      setMessages(current => [...current, { role: "user", content: payload.message }]); setInput("");
    }
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      updateQuota(data);
      if (!response.ok) {
        setError(errorMessage(data)); setUpgrade(Boolean(data.upgradeRequired));
        // Reconcile with the server before permitting another request.
        setUncertain(Boolean(data.conversationId));
        await refreshList();
        if (data.conversationId) { await loadConversation(data.conversationId); setInput(payload.message); }
        else { setInput(payload.message); pending.current = null; setMessages(current => current.slice(0, -1)); }
        return;
      }
      setConversationId(data.conversationId); setUncertain(false); pending.current = null;
      drafts.current[conversationId ?? "new"] = ""; drafts.current[data.conversationId] = "";
      setMessages(current => [...current, { role: "assistant", content: data.answer, sources: data.patristicSources ?? [] }]);
      const url = new URL(window.location.href); url.searchParams.set("conversationId", data.conversationId); window.history.replaceState(null, "", url);
      await refreshList().catch(() => {});
    } catch {
      setInput(payload.message);
      setUncertain(true); setError("The request may still be running. Check its status, or retry the same request safely. Do not start it again with a new request ID.");
      void refreshList().catch(() => {});
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function recover() {
    if (!conversationId || !interrupted || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/recover`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: interrupted.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadConversation(conversationId); setInput(data.question); setNotice(data.notice);
    } catch (error) { setError(error instanceof Error ? error.message : "Recovery failed. Reload before trying again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    {contextKey === "general" ? <h1 className="text-2xl font-semibold text-gray-950">{title}</h1> : <h2 className="text-2xl font-semibold text-gray-950">{title}</h2>}
    <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
    <p className="mt-2 text-xs text-gray-500">Patristic research includes verified sources, curated texts, PG OCR and general web research.</p>
    <div className="my-4 flex flex-wrap gap-3">
      <label className="min-w-0 text-sm">Saved conversation <select className="mt-1 block max-w-full rounded-lg border px-3 py-2" aria-label="Saved conversation" disabled={busy} value={conversationId ?? ""}
        onChange={event => { if (event.target.value) void readSaved(event.target.value); }}>
        <option value="">Choose a conversation</option>{saved.map(item => <option key={item.id} value={item.id}>{item.contextKey} · {item.id.slice(-8)}</option>)}
      </select></label>
      <button className="rounded-lg border px-3 py-2 text-sm" type="button" disabled={busy || uncertain || Boolean(interrupted)} onClick={() => {
        if (inFlight.current) return;
        ++readVersion.current;
        drafts.current[conversationId ?? "new"] = input;
        setConversationId(undefined); setFeature(contextKey); setMessages([]); nearBottom.current = true; setAwayFromLatest(false); setInput(drafts.current.new ?? initialPrompt); setError(null); setNotice(null); setRemaining(quotaRef.current?.remaining ?? null); pending.current = null;
        const url = new URL(window.location.href); url.searchParams.delete("conversationId"); window.history.replaceState(null, "", url);
      }}>New conversation</button>
      <a href="/history" className="text-sm underline">Conversation history</a>
    </div>
    <p role="status" className="sr-only">{loadingConversation ? "Loading saved conversation." : busy ? "Request in progress." : messages.length ? "Conversation ready." : "Ready for your first question."}</p>
    <div ref={transcript} role="region" aria-label="Conversation messages" tabIndex={0} aria-busy={busy}
      onScroll={event => { const element = event.currentTarget; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; setAwayFromLatest(!nearBottom.current); }}
      className="max-h-[36rem] space-y-4 overflow-y-auto rounded-xl bg-gray-50 p-3 sm:p-4">
      {!messages.length && !busy && <p className="text-sm text-gray-600">Start a conversation with a question, or choose a saved conversation above.</p>}
      {messages.map((message, index) => <article key={index} className={`rounded-xl p-4 text-sm ${message.role === "user" ? "sm:ml-8 bg-gray-950 text-white" : "sm:mr-8 bg-white text-gray-900"}`}>
        <p className="mb-2 text-xs font-semibold">{message.role === "user" ? "You" : "OrthodoxAI"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.role === "assistant" && <SourceCards sources={message.sources ?? []} />}
      </article>)}
      {busy && <p>{loadingConversation ? "Loading saved conversation..." : "OrthodoxAI is working..."}</p>}
    </div>
    {awayFromLatest && <button type="button" className="mt-3 rounded-lg border px-4 py-3 text-sm" onClick={() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; nearBottom.current = true; setAwayFromLatest(false); }}>Jump to latest message</button>}
    {remaining !== null && <p className="mt-3 text-xs">Questions remaining today: {remaining}</p>}
    {error && <div role="alert" className="mt-4 rounded border border-red-200 p-3 text-sm text-red-700">{error}<button type="button" disabled={busy} onClick={() => void readSaved(conversationId)} className="ml-2 rounded border px-3 py-2 underline">Check saved status</button>{upgrade && <a className="ml-2 underline" href="/pricing">Upgrade to Pro</a>}</div>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {uncertain && <div className="mt-3 flex flex-wrap gap-3 text-sm">
      <button className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => void sendMessage(true)}>Retry same request</button>
      <button className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => { void readSaved(conversationId); }}>Check saved status</button>
      <p>Select an interrupted conversation above to recover it.</p>
    </div>}
    {interrupted && <div className="mt-4 rounded border border-amber-300 p-3 text-sm">
      <p>Unfinished turn: {interrupted.question}</p>
      <p>Recovering prevents the earlier attempt from saving an answer. Sending again uses normal quota; you may need to wait for the earlier AI operation to finish.</p>
      <button disabled={busy} onClick={() => void recover()} className="mt-2 underline">Recover turn and prepare a new request</button>
      <button disabled={busy} onClick={() => { if (conversationId) void readSaved(conversationId); }} className="ml-3 underline">Reload saved status</button>
    </div>}
    <label htmlFor="chat-message" className="mt-4 block text-sm">Your question</label>
    <textarea aria-describedby="chat-message-help" maxLength={20000} id="chat-message" value={input} disabled={busy || uncertain || Boolean(interrupted)} onChange={event => setInput(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }}
      className="mt-2 min-h-28 w-full rounded-xl border border-gray-300 p-4 text-sm text-gray-950" />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><p id="chat-message-help">Enter to send; Shift + Enter for a new line.</p>
      <button disabled={busy || uncertain || Boolean(interrupted) || !input.trim()} onClick={() => void sendMessage()} className="rounded-lg bg-gray-950 px-5 py-2 text-white disabled:opacity-50">Send</button>
    </div>
  </section>;
}

"use client";

import { useState } from "react";
import type { ChatContextKey } from "@/lib/ai/chatContexts";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatBoxProps = {
  contextKey?: ChatContextKey;
  title?: string;
  subtitle?: string;

  initialPrompt?: string;
};

export function ChatBox({
  contextKey = "general",
  title = "Ask OrthodoxAI",
  subtitle = "Ask a question about Orthodox prayer, fasting, Scripture, worship, or daily spiritual life.",

  initialPrompt = "",
}: ChatBoxProps) {
  const [input, setInput] = useState(initialPrompt);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setError(null);
    setUpgradeRequired(false);

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          contextKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");

        if (data.upgradeRequired) {
          setUpgradeRequired(true);
        }

        return;
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.answer,
      };

      setMessages((current) => [...current, assistantMessage]);

      if (typeof data.remaining === "number") {
        setRemaining(data.remaining);
      } else {
        setRemaining(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{subtitle}</p>

        {remaining !== null && (
          <p className="mt-3 text-sm text-gray-500">
            Free questions remaining today: {remaining}
          </p>
        )}
      </div>

      <div className="mt-6 min-h-[320px] space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
        {messages.length === 0 && (
          <div className="rounded-xl bg-white p-4 text-sm leading-6 text-gray-600">
            <p>
              You can ask OrthodoxAI about prayer, fasting, Scripture, saints,
              feast days, worship, or practical Orthodox Christian life.
            </p>
          
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl bg-gray-950 px-4 py-3 text-sm leading-6 text-white"
                : "mr-auto max-w-[85%] rounded-xl bg-white px-4 py-3 text-sm leading-6 text-gray-800 shadow-sm"
            }
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="mr-auto max-w-[85%] rounded-xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            OrthodoxAI is thinking...
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>

          {upgradeRequired && (
            <a
              href="/pricing"
              className="mt-3 inline-block rounded-lg bg-gray-950 px-4 py-2 text-white"
            >
              Upgrade to Pro
            </a>
          )}
        </div>
      )}

      <div className="mt-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
         
          className="min-h-28 w-full resize-none rounded-xl border border-gray-300 p-4 text-sm text-gray-950 placeholder:text-gray-400 outline-none focus:border-gray-950"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Press Enter to send, Shift + Enter for a new line.
          </p>

          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
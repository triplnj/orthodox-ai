"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeBlogPaste } from "@/app/admin/blog/actions";

type BlogContentEditorProps = {
  name: string;
  defaultValue?: string | null;
};

export function BlogContentEditor({
  name,
  defaultValue = "",
}: BlogContentEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState(defaultValue ?? "");
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current && defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
  }, [defaultValue]);

  function syncHtml() {
    setHtml(editorRef.current?.innerHTML ?? "");
  }

  function runCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    syncHtml();
    editorRef.current?.focus();
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    setPasteError(null);
    const richText = event.clipboardData.getData("text/html");
    const plainText = event.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;

    try {
      const safeHtml = richText ? await sanitizeBlogPaste(richText) : null;
      if (!editorRef.current || !range || !editorRef.current.contains(range.commonAncestorContainer)) return;
      editorRef.current.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (safeHtml !== null) {
        document.execCommand("insertHTML", false, safeHtml);
      } else {
        document.execCommand("insertText", false, plainText);
      }
      syncHtml();
    } catch {
      setPasteError("Could not safely paste this content. Please try again.");
    }
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-gray-300 bg-white">
      <input type="hidden" name={name} value={html} />

      <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-3">
        <button
          type="button"
          onClick={() => runCommand("formatBlock", "h2")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => runCommand("formatBlock", "h3")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => runCommand("formatBlock", "p")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          Paragraph
        </button>
        <button
          type="button"
          onClick={() => runCommand("bold")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => runCommand("italic")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => runCommand("insertUnorderedList")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          Bullet list
        </button>
        <button
          type="button"
          onClick={() => runCommand("insertOrderedList")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-gray-950"
        >
          Numbered list
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Blog content"
        aria-multiline="true"
        onPaste={handlePaste}
        onDrop={(event) => event.preventDefault()}
        onInput={syncHtml}
        onBlur={syncHtml}
        className="min-h-[420px] w-full bg-white px-5 py-4 text-base leading-8 text-gray-900 outline-none prose-content-editor"
        data-placeholder="Paste or write your blog post here. Formatting from Word or Google Docs will be preserved where the browser allows it."
      />
      {pasteError && <p role="alert" className="px-5 py-2 text-sm text-red-700">{pasteError}</p>}
    </div>
  );
}

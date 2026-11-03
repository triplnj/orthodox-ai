import type { ReactNode } from "react";

// Render assistant Markdown emphasis without exposing raw asterisk delimiters.
// Works with partial streamed output and with previously saved answers.
export function AnswerText({ content }: { content: string }) {
  const chunks = content.split(/(\*\*[\s\S]+?\*\*)/g);
  const rendered: ReactNode[] = chunks.map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return <strong key={index} className="font-semibold">{chunk.slice(2, -2).replace(/\*/g, "")}</strong>;
    }
    return <span key={index}>{chunk.replace(/\*/g, "")}</span>;
  });
  return <>{rendered}</>;
}

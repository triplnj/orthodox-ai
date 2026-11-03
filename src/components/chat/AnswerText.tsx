import type { ReactNode } from "react";

/** Present assistant Markdown as safe React text without leaking markup syntax. */
export function normalizeAnswerText(value: string) {
  return value
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_match, name: string) =>
      ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name.toLowerCase() as "nbsp"])
    .replace(/\\([\\#*_~.>\-])/g, "$1")
    .replace(/\u00a0/g, " ");
}

function inline(content: string): ReactNode[] {
  return content.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\`[^\`\n]+\`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part.replace(/[*\`]/g, "")}</span>;
  });
}

export function AnswerText({ content }: { content: string }) {
  const lines = normalizeAnswerText(content).replace(/\r\n?/g, "\n").split("\n");
  return <div className="space-y-2 break-words">{lines.map((raw, index) => {
    const line = raw.trim();
    if (!line) return null;
    if (/^(?:-{3,}|_{3,}|\*{3,})$/.test(line)) return <hr key={index} className="my-3 border-gray-200" />;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) return <p key={index} className="pt-1 font-semibold">{inline(heading[1])}</p>;
    const bullet = line.match(/^(?:[-+*]|\d+[.)])\s+(.+)$/);
    if (bullet) return <p key={index} className="pl-3">• {inline(bullet[1])}</p>;
    return <p key={index} className="whitespace-pre-wrap">{inline(line.replace(/^#{1,6}(?=\S)/, ""))}</p>;
  })}</div>;
}

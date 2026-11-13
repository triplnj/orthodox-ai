import type { ClaimAudit } from "./claim-audit";

/**
 * The model draft is not user-visible evidence. In an excerpt-backed patristic
 * answer, show only claim units which survived the independent source audit.
 * Never retain the draft's unsupported introductions, conclusions, or offers.
 * A source-only link does not make the underlying draft safe.
 */
export function gatePatristicAnswer(
  draft: string,
  audit: ClaimAudit,
  language: "sr" | "en",
): string {
  const unavailable = language === "sr"
    ? "Нисам успео да потврдим конкретне тврдње о учењу светог оца у доступним одломцима. Нећу приказати непроверен одговор као утврђено учење."
    : "I could not substantiate specific claims about this Father's teaching in the available excerpts. I will not present an unverified answer as established doctrine.";
  if (audit.status !== "completed" || !audit.claims.length) return unavailable;
  const checked = audit.claims.filter(item =>
    item.status === "excerpt_matched" &&
    item.sourceIndex !== null &&
    typeof item.evidenceQuote === "string" &&
    item.evidenceQuote.length >= 25 &&
    draft.includes(item.claim)
  );
  if (!checked.length) return unavailable;
  return checked.map(item => item.claim).join("\n\n");
}

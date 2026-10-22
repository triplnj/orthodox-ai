import "server-only";

export type ReviewKind = "fr-josiah" | "clergy";
export class ReviewIdentityError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(status === 409 ? "Review access requires operator assistance." : "Review access is temporarily unavailable.");
  }
}
export function reviewIdentities() {
  const entries = [
    { kind: "fr-josiah" as const, id: process.env.REVIEW_USER_ID, email: process.env.REVIEW_USER_EMAIL ?? "fr-josiah-review@orthodoxai.app" },
    { kind: "clergy" as const, id: process.env.REVIEW_CLERGY_USER_ID, email: process.env.REVIEW_CLERGY_USER_EMAIL ?? "clergy-review@orthodoxai.app" },
  ].map(entry => {
    // Billing's existing protected-review comparison is case-insensitive, without trimming.
    if (entry.email !== entry.email.trim()) throw new ReviewIdentityError(503, "REVIEW_CONFIGURATION_INVALID");
    return { ...entry, email: entry.email.toLowerCase() };
  });
  if (entries.some(entry => !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(entry.email) || entry.email.length > 254 ||
    (entry.id !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.id))) ||
    entries[0].email === entries[1].email || (entries[0].id && entries[0].id === entries[1].id)) {
    throw new ReviewIdentityError(503, "REVIEW_CONFIGURATION_INVALID");
  }
  return entries;
}
export function reviewIdentity(kind: ReviewKind) {
  const identity = reviewIdentities().find(entry => entry.kind === kind)!;
  if (!identity.id) throw new ReviewIdentityError(503, "REVIEW_IDENTITY_NOT_CONFIGURED");
  return { ...identity, id: identity.id };
}
export function isDedicatedReviewIdentity(id: string) {
  return reviewIdentities().some(identity => identity.id === id);
}
export function isReservedReviewEmail(email: string) {
  return reviewIdentities().some(identity => identity.email === email.trim().toLowerCase());
}

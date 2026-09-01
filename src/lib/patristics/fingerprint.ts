import crypto from "crypto";

export function quoteFingerprint(
  author: string,
  _work: string,
  originalText: string,
) {
  const value = [
    author,
    originalText,
  ]
    .join("|")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Paddle Billing's ts/h1 signature against the exact raw request body.
 * Never parse or stringify the body before calling this function.
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signatureHeader || rawBody.length > 1024 * 1024) return false;
  const parts = signatureHeader.split(";").map((part) => part.trim());
  const timestamps = parts.filter((part) => /^ts=\d+$/.test(part));
  const signatures = parts.filter((part) => /^h1=[a-f\d]{64}$/i.test(part));
  if (timestamps.length !== 1 || signatures.length !== 1) return false;
  const ts = Number(timestamps[0].slice(3));
  if (!Number.isSafeInteger(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const actual = Buffer.from(signatures[0].slice(3), "hex");
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

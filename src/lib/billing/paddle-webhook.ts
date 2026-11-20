import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paddle Billing webhook authentication only. No account or subscription writes.
 * See https://developer.paddle.com/webhooks/about/signature-verification
 * Never parse and reserialize the raw body before verifying its signature.
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  endpointSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!endpointSecret || !signatureHeader || rawBody.length > 256_000) return false;
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) return false;

  const fields = signatureHeader.split(";").map(part => part.trim());
  const timestamps = fields.filter(part => /^ts=\d+$/.test(part));
  const signatures = fields.filter(part => /^h1=[a-f0-9]{64}$/i.test(part));
  // Reject duplicate timestamps and all unrecognized header segments.
  if (timestamps.length !== 1 || signatures.length === 0 ||
      fields.length !== timestamps.length + signatures.length) return false;
  const timestamp = Number(timestamps[0].slice(3));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", endpointSecret)
    .update(`${timestamp}:${rawBody}`, "utf8").digest();
  return signatures.some(part =>
    timingSafeEqual(expected, Buffer.from(part.slice(3), "hex")));
}

/** Do not grant live Pro entitlements on sandbox events or client redirects. */
export const PADDLE_PHASE_ONE_MODE = "DISABLED" as const;

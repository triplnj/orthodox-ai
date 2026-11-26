import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Non-payment checkout ownership proof. Requires server-side verification
 * before any Paddle event may be associated with a user.
 */
export const PADDLE_CHECKOUT_BINDING_VERSION = "1";
const MAX_AGE_SECONDS = 30 * 60;

type SignedFields = { userId: string; issuedAt: number; nonce: string; signature: string };

function mac(secret: string, userId: string, issuedAt: number, nonce: string) {
  return createHmac("sha256", secret)
    .update(["orthodoxai:paddle:sandbox:checkout:v1", userId, String(issuedAt), nonce].join(":"))
    .digest("hex");
}

export function makePaddleCheckoutBinding(userId: string, secret: string, issuedAt = Math.floor(Date.now() / 1000)) {
  if (!userId || userId.length > 256 || /[^a-zA-Z0-9_-]/.test(userId) ||
      !secret.startsWith("pdl_ntfset_") || !Number.isSafeInteger(issuedAt)) {
    throw new Error("Invalid sandbox binding configuration.");
  }
  const nonce = randomBytes(16).toString("hex");
  return {
    orthodoxai_binding_version: PADDLE_CHECKOUT_BINDING_VERSION,
    orthodoxai_user_id: userId,
    orthodoxai_issued_at: issuedAt,
    orthodoxai_nonce: nonce,
    orthodoxai_signature: mac(secret, userId, issuedAt, nonce),
  };
}

/** Only usable after independently verifying Paddle's webhook signature. */
export function verifyPaddleCheckoutBinding(data: unknown, secret: string,
  now = Math.floor(Date.now() / 1000)): { userId: string } | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || !secret.startsWith("pdl_ntfset_")) return null;
  const fields = data as Record<string, unknown>;
  const { orthodoxai_binding_version: version, orthodoxai_user_id: userId,
    orthodoxai_issued_at: issuedAt, orthodoxai_nonce: nonce, orthodoxai_signature: signature } = fields;
  if (version !== PADDLE_CHECKOUT_BINDING_VERSION ||
      typeof userId !== "string" || !userId || userId.length > 256 || /[^a-zA-Z0-9_-]/.test(userId) ||
      typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt) ||
      typeof nonce !== "string" || !/^[a-f0-9]{32}$/.test(nonce) ||
      typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature) ||
      !Number.isSafeInteger(now) || issuedAt > now + 30 || now - issuedAt > MAX_AGE_SECONDS) return null;
  const expected = Buffer.from(mac(secret, userId, issuedAt, nonce), "hex");
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? { userId } : null;
}

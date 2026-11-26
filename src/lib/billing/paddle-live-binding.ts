import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Ownership authentication for the *Live* catalog; never reuse Sandbox keys.
 * A client-side checkout result is not payment evidence.
 */
const domain = "orthodoxai:paddle:live:checkout:v1";
export function makePaddleLiveBinding(userId: string, secret: string,
  issuedAt = Math.floor(Date.now() / 1000), attemptId?: string) {
 if (!/^[a-zA-Z0-9_-]{1,256}$/.test(userId) || secret.length < 32 ||
     !Number.isSafeInteger(issuedAt) || (attemptId !== undefined &&
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attemptId))) throw Error("Live checkout binding unavailable.");
 const nonce = randomBytes(16).toString("hex");
 const signature = createHmac("sha256", secret)
   .update([domain, userId, issuedAt, nonce, attemptId ?? ""].join(":")).digest("hex");
 return {
   orthodoxai_binding_version: "live-1",
   orthodoxai_user_id: userId,
   orthodoxai_issued_at: issuedAt,
   orthodoxai_nonce: nonce,
   orthodoxai_signature: signature,
   ...(attemptId ? { orthodoxai_checkout_attempt_id: attemptId } : {}),
 };
}
export function verifyPaddleLiveBinding(input: unknown, secret: string,
 now = Math.floor(Date.now() / 1000)): { userId: string } | null {
 if (!input || typeof input !== "object" || Array.isArray(input) ||
     secret.length < 32) return null;
 const v = input as Record<string, unknown>;
 const user = v.orthodoxai_user_id;
 const issued = v.orthodoxai_issued_at;
 const nonce = v.orthodoxai_nonce;
 const signature = v.orthodoxai_signature;
 const attemptId = v.orthodoxai_checkout_attempt_id;
 if (v.orthodoxai_binding_version !== "live-1" ||
     typeof user !== "string" || !/^[a-zA-Z0-9_-]{1,256}$/.test(user) ||
     typeof issued !== "number" || !Number.isSafeInteger(issued) ||
     typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce) ||
     (attemptId !== undefined && (typeof attemptId !== "string" ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attemptId))) ||
     typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature) ||
     !Number.isSafeInteger(now) || issued > now + 30 || now - issued > 1800) return null;
 const expected = createHmac("sha256", secret)
   .update([domain, user, issued, nonce, attemptId ?? ""].join(":")).digest();
 return timingSafeEqual(expected, Buffer.from(signature, "hex"))
   ? { userId: user } : null;
}

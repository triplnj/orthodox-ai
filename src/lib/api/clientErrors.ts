export type ClientQuota = { pool: string; limit: number; used: number; remaining: number; observedAt: string; resetsAt: string; timezone?: string };
export function newerQuota(current: ClientQuota | null, next: ClientQuota | undefined) {
  return next && (!current || Date.parse(next.observedAt) >= Date.parse(current.observedAt)) ? next : current;
}
export function errorMessage(data: { error?: string; code?: string; limitType?: string; quota?: ClientQuota; retryAfterSeconds?: number }) {
  const message = data.error ?? "The request could not be completed.";
  if (data.code === "DAILY_QUOTA_EXHAUSTED" || data.limitType === "daily") return `${message}${data.quota ? ` Resets at ${new Date(data.quota.resetsAt).toLocaleString()} (${data.quota.timezone ?? "server time"}).` : ""}`;
  if (data.code === "RATE_LIMITED" || data.limitType === "rate") return `${message} This is a temporary rate limit.${data.retryAfterSeconds ? ` Try again in ${data.retryAfterSeconds} seconds.` : ""}`;
  return message;
}

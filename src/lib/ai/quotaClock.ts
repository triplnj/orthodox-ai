import "server-only";
import { ApiError } from "@/lib/api/validation";

export function quotaTimezone() {
  // A missing value preserves the old host timezone. Deployment must explicitly
  // pin AI_QUOTA_TIMEZONE to that existing IANA zone before rolling out.
  const host = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = process.env.AI_QUOTA_TIMEZONE || host;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); }
  catch { throw new ApiError("AI quota timezone configuration is invalid.", 503, "QUOTA_CONFIGURATION_UNAVAILABLE"); }
  if (process.env.NODE_ENV === "production" && !process.env.AI_QUOTA_TIMEZONE) throw new ApiError("AI quota timezone must be explicitly configured before enabling AI operations.", 503, "QUOTA_CONFIGURATION_UNAVAILABLE");
  return zone;
}
function localDate(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return [get("year"), get("month"), get("day")] as const;
}
export function quotaDay(now = new Date()) {
  const zone = quotaTimezone(); const target = localDate(now, zone);
  const dateKey = (date: Date) => localDate(date, zone).reduce((key, part) => key * 100 + part, 0);
  const startOf = (year: number, month: number, day: number) => {
    const key = year * 10000 + month * 100 + day;
    let low = Date.UTC(year, month - 1, day) - 36 * 3600000;
    let high = low + 72 * 3600000;
    // Find the first instant of the local calendar day, including DST changes.
    while (low < high) { const mid = Math.floor((low + high) / 2); if (dateKey(new Date(mid)) < key) low = mid + 1; else high = mid; }
    return new Date(low);
  };
  const next = new Date(Date.UTC(target[0], target[1] - 1, target[2] + 1));
  return { start: startOf(...target), reset: startOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()), timezone: zone };
}

/** Shared by the client and server; never feed an unchecked value to router.push. */
export function safeLoginPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  let decoded = value;
  for (let i = 0; i < 5; i++) {
    if (/[\\\x00-\x20\x7f]/.test(decoded) || decoded.startsWith("//")) return "/dashboard";
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { return "/dashboard"; }
  }
  if (decoded.includes("%") || /[\\\x00-\x20\x7f]/.test(decoded) || decoded.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://application.invalid");
    const decodedPath = new URL(decoded, "https://application.invalid").pathname;
    if (url.origin !== "https://application.invalid" || /^\/(api|login|register|logout)(\/|$)/i.test(decodedPath)) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}

import "server-only";
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";

export function hostnameOnly(value: string): string {
  const host = value.toLowerCase();
  if (host.length > 253 || !host.includes(".") || !/^[a-z0-9.-]+$/.test(host) ||
      host.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || isIP(host)) {
    throw new Error("An exact DNS hostname is required.");
  }
  return host;
}
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    const first = parseInt(address.split(":")[0], 16);
    // Only global unicast; reject mapped IPv4, ULA/link-local, multicast,
    // documentation, transition mechanisms and IETF protocol-assignment ranges.
    return first >= 0x2000 && first <= 0x3fff && !/^2002:/i.test(address) &&
      !/^2001:(?:0*(?:[0-9a-f]{1,2}|1[0-9a-f]{2})|0*db8)(?=:)/i.test(address) &&
      !/^3fff:/i.test(address);
  }
  return false;
}
export async function resolvePublicAddresses(host: string, signal: AbortSignal): Promise<string[]> {
  hostnameOnly(host);
  const resolver = new Resolver({ timeout: 2000, tries: 2 });
  const cancel = () => resolver.cancel();
  if (signal.aborted) throw new Error("Source resolution aborted.");
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const results = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const addresses = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (signal.aborted || !addresses.length || addresses.some(address => !publicAddress(address))) throw new Error("Source has an unsafe or unresolved DNS destination.");
    return [...new Set(addresses)];
  } finally { signal.removeEventListener("abort", cancel); resolver.cancel(); }
}

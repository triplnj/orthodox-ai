import "server-only";
import { prisma } from "@/lib/prisma";
import { hostnameOnly } from "./public-dns";

const baseHosts = ["azbyka.ru", "pravoslavie.ru", "doxologia.ro", "svetigora.com", "svetosavlje.org",
  "churchofcyprus.org.cy", "agiooros.org", "newadvent.org", "orthodoxchurchfathers.com", "matia.gr",
  "catholiclibrary.org", "remacle.org", "syri.ac", "gorgiaspress.com", "vlioras.gr", "gutenberg.org",
  "archive.org", "patrologiagraeca.org", "biblegateway.com", "philokalia.com"];
export const SOURCE_HOSTS = new Set([...baseHosts.flatMap(host => [host, `www.${host}`]),
  "en.wikisource.org", "el.wikisource.org", "la.wikisource.org", "commons.wikimedia.org", "upload.wikimedia.org",
  "onlinebooks.library.upenn.edu"]);
const archiveShard = (host: string) => /^(?:ia\d+\.us|dn\d+\.ca)\.archive\.org$/.test(host);
export function sourceUrl(value: string): URL {
  if (value.length > 4096 || /[\\\x00-\x20\x7f]/.test(value)) throw new Error("Invalid source URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password) throw new Error("A credential-free HTTPS source URL is required.");
  url.hash = ""; // Citation fragments are valid but are never sent to the server.
  hostnameOnly(url.hostname);
  return url;
}
export async function allowedSource(host: string, redirectFrom?: string): Promise<boolean> {
  const record = await prisma.patristicSourceDomain.findUnique({ where: { hostname: host } });
  if (record?.enabled === false) return false;
  const configured = record?.enabled === true || SOURCE_HOSTS.has(host);
  if (!redirectFrom) return configured; // Archive shards are redirect-only.
  if (host === redirectFrom) return configured || archiveShard(host);
  const origin = await prisma.patristicSourceDomain.findUnique({ where: { hostname: redirectFrom } });
  if (origin?.enabled === false) return false;
  if (origin?.redirectHosts.includes(host) && configured) return true;
  if (host.replace(/^www\./, "") === redirectFrom.replace(/^www\./, "")) return configured;
  if (["archive.org", "www.archive.org"].includes(redirectFrom) && archiveShard(host)) return true;
  if (archiveShard(redirectFrom) && (["archive.org", "www.archive.org"].includes(host) || archiveShard(host))) return true;
  if (redirectFrom === "onlinebooks.library.upenn.edu" && ["archive.org", "www.archive.org"].includes(host)) return true;
  if (["commons.wikimedia.org", "en.wikisource.org", "el.wikisource.org", "la.wikisource.org"].includes(redirectFrom) && host === "upload.wikimedia.org") return true;
  return false;
}

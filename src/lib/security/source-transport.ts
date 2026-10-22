import "server-only";
import { request } from "node:https";
import { isIP } from "node:net";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import type { Readable } from "node:stream";
import { resolvePublicAddresses, publicAddress } from "./public-dns";
import { sourceUrl, allowedSource } from "./source-policy";

type SourceInit = RequestInit & { next?: { revalidate?: number } };
type Reply = { status: number; headers: Headers; bytes: Uint8Array };
export async function pinnedSourceRequest(url: URL, init: SourceInit, signal: AbortSignal, maxBytes: number): Promise<Reply> {
  const addresses = await resolvePublicAddresses(url.hostname, AbortSignal.any([signal, AbortSignal.timeout(10000)]));
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const input = new Headers(init.headers);
    // Only these public source headers may cross a network hop.
    const headers: Record<string, string> = { "User-Agent": "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)", "Accept-Encoding": "identity" };
    for (const name of ["accept", "range"]) { const value = input.get(name); if (value) headers[name] = value; }
    const req = request(url, { method: init.method ?? "GET", headers, signal,
      agent: false, family: isIP(address), servername: url.hostname, rejectUnauthorized: true,
      lookup: (_hostname, _options, callback) => callback(null, address, isIP(address)),
    }, response => {
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined && key !== "set-cookie") responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const status = response.statusCode ?? 502;
      if ([301, 302, 303, 307, 308].includes(status) || init.method === "HEAD") {
        response.destroy(); resolve({ status, headers: responseHeaders, bytes: new Uint8Array() }); return;
      }
      if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
        response.destroy(); reject(new Error("Source exceeds response-size limit.")); return;
      }
      let rawSize = 0;
      response.on("data", chunk => { rawSize += chunk.length; if (rawSize > maxBytes) response.destroy(new Error("Source exceeds wire-size limit.")); });
      const encoding = responseHeaders.get("content-encoding")?.toLowerCase();
      let stream: Readable = response;
      response.on("aborted", () => { stream.destroy(new Error("Source response aborted.")); reject(new Error("Source response aborted.")); });
      if (encoding && encoding !== "identity") {
        const decoder = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : encoding === "br" ? createBrotliDecompress() : null;
        if (!decoder) { response.destroy(); reject(new Error("Unsupported source encoding.")); return; }
        stream = response.pipe(decoder);
        response.on("error", error => decoder.destroy(error));
      }
      const chunks: Buffer[] = []; let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { stream.destroy(new Error("Source exceeds decoded-size limit.")); response.destroy(); return; }
        chunks.push(chunk);
      });
      stream.on("error", error => { response.destroy(); req.destroy(); reject(error); });
      stream.on("end", () => {
        responseHeaders.delete("content-encoding"); responseHeaders.delete("content-length");
        resolve({ status, headers: responseHeaders, bytes: Buffer.concat(chunks) });
      });
    });
    req.on("socket", socket => socket.once("secureConnect", () => {
      // Pin DNS and verify the connected peer; TLS still validates the hostname.
      if (!socket.remoteAddress || !publicAddress(socket.remoteAddress) ||
          socket.remoteAddress.replace(/^::ffff:/i, "") !== address.replace(/^::ffff:/i, "")) req.destroy(new Error("Unexpected source peer address."));
    }));
    req.on("error", reject);
    const timer = setTimeout(() => req.destroy(new Error("Source connection timed out.")), 10000);
    req.on("response", () => clearTimeout(timer));
    req.on("close", () => clearTimeout(timer));
    req.end();
  });
}
export async function safeSourceFetch(value: string | URL, init: SourceInit = {}): Promise<Response> {
  if (init.method && !["GET", "HEAD"].includes(init.method)) throw new Error("Source retrieval supports GET/HEAD only.");
  let url = sourceUrl(String(value));
  const large = /(?:_djvu\.(?:xml|txt)|_scandata\.xml)(?:$|\?)/i.test(url.href);
  const pdf = /\.pdf(?:$|\?)/i.test(url.href);
  const image = /\.(?:jpg|jpeg|png)(?:$|\?)/i.test(url.href);
  const maxBytes = (large ? 100 : pdf ? 50 : image ? 20 : 10) * 1024 * 1024;
  const signal = AbortSignal.any([AbortSignal.timeout(large || pdf ? 60000 : 30000), ...(init.signal ? [init.signal] : [])]);
  let from: string | undefined;
  for (let hop = 0; hop <= 5; hop++) {
    if (!await allowedSource(url.hostname, from)) throw new Error("Source domain or redirect is not authorized.");
    const reply = await pinnedSourceRequest(url, init, signal, maxBytes);
    if (![301, 302, 303, 307, 308].includes(reply.status)) {
      return new Response(init.method === "HEAD" || [204, 205, 304].includes(reply.status) ? null : reply.bytes as BodyInit,
        { status: reply.status, headers: reply.headers });
    }
    const location = reply.headers.get("location");
    if (!location || hop === 5) throw new Error("Source redirect limit exceeded or missing destination.");
    from = url.hostname; url = sourceUrl(new URL(location, url).toString());
  }
  throw new Error("Source redirect limit exceeded.");
}

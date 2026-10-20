import { config } from "./config";
import { runAudit } from "./engine";
import type { ScanResult } from "./types";

export interface ParsedUrls {
  urls: string[];
  /** Lines that aren't http(s) URLs. */
  invalid: string[];
  /** Valid URLs beyond the limit that won't be scanned. */
  ignored: number;
}

/** Browsers accept almost any string as a host, so also require a dot, localhost or an IPv6 literal. */
function looksLikeHost(hostname: string): boolean {
  return hostname.includes(".") || hostname === "localhost" || hostname.startsWith("[");
}

/** One URL per line. Bare domains get https://. Duplicates (ignoring #hash) are dropped. */
export function parseUrlList(text: string, limit: number = config.bulkScanLimit): ParsedUrls {
  const seen = new Set<string>();
  const urls: string[] = [];
  const invalid: string[] = [];
  let ignored = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    let url: URL | undefined;
    try {
      // "host:port" is a bare domain; any other "scheme:" (ftp:, mailto:…) isn't a web address.
      const otherScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw) && !/^https?:/i.test(raw);
      if (!otherScheme) url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      // invalid, handled below
    }
    if (!url || !/^https?:$/.test(url.protocol) || /\s/.test(raw) || !looksLikeHost(url.hostname)) {
      invalid.push(raw);
      continue;
    }
    url.hash = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    if (urls.length >= limit) ignored++;
    else urls.push(url.href);
  }
  return { urls, invalid, ignored };
}

/** Audits fetched HTML. Scripts are not run, so JavaScript-rendered content is not included. */
export function auditHtml(html: string, url: string, headers: Record<string, string>, robotsTxt?: string): ScanResult {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const { issues, score } = runAudit(doc, { url, headers, robotsTxt });
  return { url, title: doc.title, scannedAt: Date.now(), score, issues };
}

export interface BulkRow {
  /** The URL as requested. */
  url: string;
  result?: ScanResult;
  error?: string;
}

type Fetcher = (url: string) => Promise<Response>;

const TIMEOUT_MS = 15_000;
const defaultFetcher: Fetcher = (url) =>
  fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

async function scanOne(url: string, fetcher: Fetcher, robotsFor: (origin: string) => Promise<string | undefined>): Promise<BulkRow> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type");
    if (type && !/html/i.test(type)) return { url, error: "Not an HTML page" };

    const html = await res.text();
    const finalUrl = res.url || url;
    const headers = Object.fromEntries(Array.from(res.headers, ([name, value]) => [name.toLowerCase(), value]));
    const robotsTxt = await robotsFor(new URL(finalUrl).origin);
    return { url, result: auditHtml(html, finalUrl, headers, robotsTxt) };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { url, error: timedOut ? "Timed out" : "Could not load the page" };
  }
}

/** Fetches and audits each URL. Rows come back in input order; onRow fires as each finishes. */
export async function bulkScan(
  urls: string[],
  options: { fetcher?: Fetcher; concurrency?: number; onRow?: (row: BulkRow, done: number, total: number) => void } = {},
): Promise<BulkRow[]> {
  const { fetcher = defaultFetcher, concurrency = 4, onRow } = options;
  const rows: BulkRow[] = new Array(urls.length);
  const robots = new Map<string, Promise<string | undefined>>();
  const robotsFor = (origin: string) => {
    if (!robots.has(origin)) {
      robots.set(
        origin,
        fetcher(`${origin}/robots.txt`).then(
          (res) => (res.ok ? res.text() : undefined),
          () => undefined,
        ),
      );
    }
    return robots.get(origin)!;
  };

  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      rows[index] = await scanOne(urls[index], fetcher, robotsFor);
      onRow?.(rows[index], ++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return rows;
}

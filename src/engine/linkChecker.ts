import { config } from "../config";

/** Unique same-origin http(s) link URLs (hash removed), up to `limit`. */
export function getSameOriginLinks(doc: Document, pageUrl: string, limit: number = config.brokenLinkCheckLimit): string[] {
  const origin = new URL(pageUrl).origin;
  const urls = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href")!.trim();
    if (!href || href.startsWith("#")) continue;
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin) continue;
    url.hash = "";
    urls.add(url.href);
    if (urls.size >= limit) break;
  }
  return Array.from(urls);
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, "status" | "ok">>;

async function statusOf(url: string, fetcher: Fetcher): Promise<number> {
  try {
    const head = await fetcher(url, { method: "HEAD", redirect: "follow" });
    if (head.ok) return head.status;
  } catch {
    // fall through to GET
  }
  try {
    return (await fetcher(url, { method: "GET", redirect: "follow" })).status;
  } catch {
    return 0;
  }
}

/** HEAD each URL (falling back to GET). Returns status per URL; 0 means no response. */
export async function checkLinks(
  urls: string[],
  fetcher: Fetcher = (url, init) => fetch(url, init),
  concurrency = 6,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) results[url] = await statusOf(url, fetcher);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}

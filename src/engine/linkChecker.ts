import { config } from "../config";

// The check sends requests with the user's own cookies (a GET if HEAD fails), so never request
// links that look like actions. Matches whole path segments and query names/values only.
const STATE_CHANGING = new Set(["logout", "log-out", "signout", "sign-out", "unsubscribe", "delete", "remove", "cancel", "revoke"]);

function looksStateChanging(url: URL): boolean {
  const words = [...url.pathname.split("/"), ...url.searchParams.keys(), ...url.searchParams.values()];
  return words.some((word) => STATE_CHANGING.has(word.toLowerCase().replace(/\.[a-z0-9]+$/, "")));
}

/** Unique same-origin http(s) link URLs (hash removed, action-like links left out), up to `limit`. */
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
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin || looksStateChanging(url)) continue;
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

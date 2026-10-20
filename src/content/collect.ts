import { checkLinks, getSameOriginLinks, runAudit } from "../engine";
import type { ScanResult } from "../types";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** The link check gets this long in total; if it runs over, it is skipped rather than blocking the scan. */
const LINK_CHECK_BUDGET_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    const finish = (value?: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    promise.then(finish, () => finish());
  });
}

/** Response headers of the page (lower-case names), or undefined if the request fails. */
async function fetchHeaders(url: string, fetcher: Fetcher): Promise<Record<string, string> | undefined> {
  try {
    let res = await fetcher(url, { method: "HEAD" });
    if (!res.ok) res = await fetcher(url, { method: "GET" });
    return Object.fromEntries(Array.from(res.headers, ([name, value]) => [name.toLowerCase(), value]));
  } catch {
    return undefined;
  }
}

/** A missing robots.txt (404) is normal; a network error or server error means the check couldn't run. */
async function fetchRobotsTxt(origin: string, fetcher: Fetcher): Promise<{ text?: string; failed: boolean }> {
  try {
    const res = await fetcher(`${origin}/robots.txt`);
    if (res.ok) return { text: await res.text(), failed: false };
    return { failed: res.status >= 500 || res.status === 429 };
  } catch {
    return { failed: true };
  }
}

/** Gathers headers, robots.txt and link statuses, then runs the audit. Partial failures become `skipped` notes. */
export async function collectScan(doc: Document, url: string, fetcher: Fetcher): Promise<ScanResult> {
  const [headers, robots, linkResults] = await Promise.all([
    fetchHeaders(url, fetcher),
    fetchRobotsTxt(new URL(url).origin, fetcher),
    withTimeout(checkLinks(getSameOriginLinks(doc, url), fetcher), LINK_CHECK_BUDGET_MS),
  ]);

  const skipped: string[] = [];
  if (!headers) skipped.push("The page's response headers couldn't be fetched, so the X-Robots-Tag check was skipped.");
  if (robots.failed) skipped.push("robots.txt couldn't be fetched, so the robots.txt check was skipped.");
  if (!linkResults) skipped.push("The broken-link check took too long and was skipped.");

  const { issues, score } = runAudit(doc, { url, headers, robotsTxt: robots.text, linkResults });
  return { url, title: doc.title, scannedAt: Date.now(), score, issues, ...(skipped.length ? { skipped } : {}) };
}

// Injected into the scanned tab (see scan.ts). Runs the audit engine on the live page.
// Fetches run in the page's own context, so same-origin requests need no host permission.
import { checkLinks, getSameOriginLinks, runAudit } from "../engine";
import type { ScanResult } from "../types";

const TIMEOUT_MS = 8000;

const timedFetch = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Response headers of the current page (lower-case names), or undefined if the request fails. */
async function fetchHeaders(url: string): Promise<Record<string, string> | undefined> {
  try {
    let res = await timedFetch(url, { method: "HEAD" });
    if (!res.ok) res = await timedFetch(url, { method: "GET" });
    return Object.fromEntries(Array.from(res.headers, ([name, value]) => [name.toLowerCase(), value]));
  } catch {
    return undefined;
  }
}

async function fetchRobotsTxt(origin: string): Promise<string | undefined> {
  try {
    const res = await timedFetch(`${origin}/robots.txt`);
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  }
}

async function scanPage(): Promise<ScanResult> {
  const url = location.href;
  const [headers, robotsTxt, linkResults] = await Promise.all([
    fetchHeaders(url),
    fetchRobotsTxt(location.origin),
    checkLinks(getSameOriginLinks(document, url), timedFetch),
  ]);
  const { issues, score } = runAudit(document, { url, headers, robotsTxt, linkResults });
  return { url, title: document.title, scannedAt: Date.now(), score, issues };
}

(window as unknown as { __launchreadyScan: typeof scanPage }).__launchreadyScan = scanPage;
